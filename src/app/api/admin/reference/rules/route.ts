import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

const createSchema = z.object({
  name: z.string().min(1),
  triggerProductivityMatchCode: z.string().nullable().optional(),
  triggerDivisionId: z.string().nullable().optional(),
  costType: z.enum(['material', 'labor', 'site', 'cleanup']),
  formula: z.any(), // discriminated by .kind, validated by engine at runtime
  materialIdRef: z.string().nullable().optional(),
  uomIn: z.string().nullable().optional(),
  uomOut: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [items, divisions, materials] = await Promise.all([
    prisma.derivativeCostRule.findMany({
      where: { companyId: ctx.companyId },
      include: {
        division: { select: { id: true, name: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
    prisma.division.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.material.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, uom: true, avgCents: true },
    }),
  ]);

  return NextResponse.json({ items, divisions, materials });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'Admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  let parsed;
  try {
    parsed = createSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json({ error: err?.issues?.[0]?.message ?? 'Invalid payload' }, { status: 400 });
  }
  const created = await prisma.derivativeCostRule.create({
    data: {
      companyId: ctx.companyId,
      ...parsed,
      createdBy: 'manual',
    },
  });
  return NextResponse.json(created, { status: 201 });
}
