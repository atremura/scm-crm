import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

const createSchema = z.object({
  name: z.string().min(1),
  divisionId: z.string().nullable().optional(),
  materialTypeId: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  uom: z.string().min(1),
  lowCents: z.number().int().nonnegative().nullable().optional(),
  avgCents: z.number().int().nonnegative(),
  highCents: z.number().int().nonnegative().nullable().optional(),
  wastePercent: z.number().int().min(0).max(50).default(5),
  supplier: z.string().nullable().optional(),
  supplierUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get('q')?.trim() ?? '';
  const divisionId = url.searchParams.get('divisionId');

  const items = await prisma.material.findMany({
    where: {
      companyId: ctx.companyId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { supplier: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(divisionId ? { divisionId } : {}),
    },
    include: {
      division: { select: { id: true, name: true } },
      materialType: { select: { id: true, name: true } },
    },
    orderBy: [{ division: { name: 'asc' } }, { name: 'asc' }],
    take: 500,
  });

  const [divisions, types] = await Promise.all([
    prisma.division.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.materialType.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return NextResponse.json({ items, divisions, types });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'Admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let parsed;
  try {
    parsed = createSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.issues?.[0]?.message ?? 'Invalid payload' },
      { status: 400 }
    );
  }

  const created = await prisma.material.create({
    data: {
      companyId: ctx.companyId,
      ...parsed,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
