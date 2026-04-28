import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

const patchSchema = z
  .object({
    markupPercent: z.number().nullable().optional(),
    overheadPercent: z.number().nullable().optional(),
    generalConditionsPercent: z.number().nullable().optional(),
    contingencyPercent: z.number().nullable().optional(),
    salesTaxPercent: z.number().nullable().optional(),
    totalEnvelopeSf: z.number().nullable().optional(),
    assumptions: z.string().nullable().optional(),
    proposalNumber: z.string().nullable().optional(),
    status: z
      .enum([
        'draft',
        'in_pricing',
        'pricing_done',
        'submitted_to_client',
        'won',
        'lost',
        'cancelled',
      ])
      .optional(),
    lostReason: z.string().nullable().optional(),
  })
  .strict();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'estimate', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const estimate = await prisma.estimate.findFirst({
      where: { id, companyId: ctx.companyId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            address: true,
            workType: true,
            // IA-1 Project Context fields — surfaced on the Estimate page so
            // Andre sees stories / equipment / assumptions inline.
            stories: true,
            durationWeeks: true,
            siteConditions: true,
            requiredEquipment: true,
            winterRisk: true,
            permitChecklist: true,
            aiContextRunAt: true,
            client: { select: { id: true, companyName: true } },
          },
        },
        region: { select: { id: true, name: true, stateCode: true } },
        owner: { select: { id: true, name: true, email: true } },
        receivedFrom: { select: { id: true, name: true } },
        lines: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            classification: { select: { id: true, scope: true } },
            productivityEntry: {
              select: { id: true, scopeName: true, divisionId: true },
            },
            laborTrade: { select: { id: true, name: true } },
          },
        },
        appliedFactors: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }
    return NextResponse.json(estimate);
  } catch (err) {
    console.error('[estimates.[id].GET]', err);
    return NextResponse.json({ error: 'Failed to fetch estimate' }, { status: 500 });
  }
}

/**
 * PATCH /api/estimates/[id]
 *
 * Edits the estimate-level fields the proposal screen surfaces:
 *   - margin %s (markup, overhead, general conditions, contingency, sales tax)
 *   - envelope SF (drives the cost-per-SF metric)
 *   - assumptions text
 *   - status transitions (draft → in_pricing → ... → won/lost/cancelled)
 *
 * Status side-effects:
 *   - 'won'  → sets wonAt = now (if not already set)
 *   - 'lost' → sets lostAt = now (if not already set)
 *   - 'submitted_to_client' → sets submittedAt = now (if not already set)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'estimate', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.estimate.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
  }

  let parsed;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  const data: any = { ...parsed };

  // Status timestamp side-effects
  if (parsed.status === 'won' && !existing.wonAt) data.wonAt = new Date();
  if (parsed.status === 'lost' && !existing.lostAt) data.lostAt = new Date();
  if (parsed.status === 'submitted_to_client' && !existing.submittedAt) {
    data.submittedAt = new Date();
  }

  try {
    const updated = await prisma.estimate.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('[estimates.[id].PATCH]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to update estimate' },
      { status: 500 }
    );
  }
}
