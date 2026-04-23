import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import {
  VALID_CLASSIFICATION_TYPES,
  VALID_UOM,
  VALID_CLASSIFICATION_SCOPES,
  typeForUom,
  type Uom,
} from '@/lib/takeoff-utils';

const patchSchema = z
  .object({
    name: z.string().min(1).optional(),
    type: z.enum(VALID_CLASSIFICATION_TYPES).optional(),
    uom: z.enum(VALID_UOM).optional(),
    scope: z.enum(VALID_CLASSIFICATION_SCOPES).optional(),
    quantity: z.number().nonnegative().optional(),
    unitCost: z.number().nonnegative().nullable().optional(),
    color: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    externalId: z.string().nullable().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; classId: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, classId } = await params;

  const existing = await prisma.classification.findFirst({
    where: { id: classId, projectId: id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: 'Classification not found' }, { status: 404 });

  let parsed;
  try {
    const body = await req.json();
    parsed = patchSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  const data: any = { ...parsed };
  // If uom changes without a matching type change, keep type in sync to avoid
  // inconsistent rows (linear with SF, etc).
  if (parsed.uom && !parsed.type) {
    data.type = typeForUom(parsed.uom as Uom);
  }

  try {
    const updated = await prisma.classification.update({
      where: { id: classId },
      data,
      include: { template: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[project.classifications.[classId].PATCH]', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; classId: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, classId } = await params;
  const existing = await prisma.classification.findFirst({
    where: { id: classId, projectId: id, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Classification not found' }, { status: 404 });

  try {
    await prisma.classification.delete({ where: { id: classId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[project.classifications.[classId].DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
