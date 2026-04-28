import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

/**
 * PATCH /api/admin/reference/suggestions/[id]
 *
 * Approve or reject a Suggestion. On approval of a derivative_rule
 * suggestion, materializes a real DerivativeCostRule and links it.
 *
 * Body shapes:
 *   { action: 'approve' }   → status='approved', also creates the
 *                              underlying entity (rule, material, etc).
 *   { action: 'reject', reviewNote?: string }
 *   { action: 'archive' }
 */
const bodySchema = z.union([
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reviewNote: z.string().nullable().optional() }),
  z.object({ action: z.literal('archive') }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'Admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  const { id } = await params;

  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.issues?.[0]?.message ?? 'Invalid payload' },
      { status: 400 }
    );
  }

  const sug = await prisma.suggestion.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!sug) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (sug.status !== 'pending') {
    return NextResponse.json(
      { error: `Suggestion already ${sug.status}` },
      { status: 400 }
    );
  }

  if (body.action === 'reject') {
    const updated = await prisma.suggestion.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewedById: ctx.userId,
        reviewedAt: new Date(),
        reviewNote: body.reviewNote ?? null,
      },
    });
    return NextResponse.json(updated);
  }

  if (body.action === 'archive') {
    const updated = await prisma.suggestion.update({
      where: { id },
      data: {
        status: 'archived',
        reviewedById: ctx.userId,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  }

  // approve — materialize the underlying entity based on type
  if (sug.type === 'derivative_rule') {
    const payload = sug.payload as any;
    const rule = await prisma.derivativeCostRule.create({
      data: {
        companyId: ctx.companyId,
        name: payload.name,
        triggerProductivityMatchCode: payload.triggerProductivityMatchCode ?? null,
        triggerDivisionId: payload.triggerDivisionId ?? null,
        costType: payload.costType,
        formula: payload.formula,
        materialIdRef: payload.materialIdRef ?? null,
        uomIn: payload.uomIn ?? null,
        uomOut: payload.uomOut ?? null,
        isActive: true,
        createdBy: 'ai-suggested-approved',
        notes: payload.notes ?? null,
      },
    });
    const updated = await prisma.suggestion.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedById: ctx.userId,
        reviewedAt: new Date(),
        appliedToTable: 'derivative_cost_rules',
        appliedToId: rule.id,
      },
    });
    return NextResponse.json({ suggestion: updated, applied: rule });
  }

  // Unsupported types (productivity / material etc.) — accept the
  // suggestion but don't materialize. Andre creates the entity manually
  // in the matching CRUD page.
  const updated = await prisma.suggestion.update({
    where: { id },
    data: {
      status: 'approved',
      reviewedById: ctx.userId,
      reviewedAt: new Date(),
      reviewNote: 'Approved without materialize — create the entity manually.',
    },
  });
  return NextResponse.json({ suggestion: updated });
}
