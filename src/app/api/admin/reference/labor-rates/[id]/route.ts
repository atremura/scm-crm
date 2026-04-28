import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

const patchSchema = z.object({
  tradeId: z.string().min(1).optional(),
  regionId: z.string().min(1).optional(),
  shopType: z.enum(['open_shop', 'union']).optional(),
  lowCents: z.number().int().nonnegative().nullable().optional(),
  avgCents: z.number().int().nonnegative().optional(),
  highCents: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'Admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { id } = await params;
  let parsed;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json({ error: err?.issues?.[0]?.message ?? 'Invalid payload' }, { status: 400 });
  }
  const existing = await prisma.laborRate.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const updated = await prisma.laborRate.update({ where: { id }, data: parsed });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'Admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { id } = await params;
  const existing = await prisma.laborRate.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.laborRate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
