import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

const createSchema = z.object({
  tradeId: z.string().min(1),
  regionId: z.string().min(1),
  shopType: z.enum(['open_shop', 'union']),
  lowCents: z.number().int().nonnegative().nullable().optional(),
  avgCents: z.number().int().nonnegative(),
  highCents: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [items, trades, regions] = await Promise.all([
    prisma.laborRate.findMany({
      where: { companyId: ctx.companyId },
      include: {
        trade: { select: { id: true, name: true } },
        region: { select: { id: true, name: true, stateCode: true } },
      },
      orderBy: [{ trade: { name: 'asc' } }, { regionId: 'asc' }, { shopType: 'asc' }],
    }),
    prisma.laborTrade.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.region.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, stateCode: true },
    }),
  ]);

  return NextResponse.json({ items, trades, regions });
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
  try {
    const created = await prisma.laborRate.create({
      data: { companyId: ctx.companyId, ...parsed },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.code === 'P2002'
          ? 'Rate already exists for this trade/region/shop type'
          : err?.message ?? 'Create failed',
      },
      { status: 400 }
    );
  }
}
