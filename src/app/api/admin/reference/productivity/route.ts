import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';

const createSchema = z.object({
  divisionId: z.string().min(1),
  scopeName: z.string().min(1),
  uom: z.string().min(1),
  crewDescription: z.string().nullable().optional(),
  assumedTradeId: z.string().nullable().optional(),
  mhPerUnitLow: z.number().nonnegative().nullable().optional(),
  mhPerUnitAvg: z.number().nonnegative(),
  mhPerUnitHigh: z.number().nonnegative().nullable().optional(),
  matchCode: z.string().nullable().optional(),
  matchKeywords: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get('q')?.trim() ?? '';
  const divisionId = url.searchParams.get('divisionId');

  const [items, divisions, trades] = await Promise.all([
    prisma.productivityEntry.findMany({
      where: {
        companyId: ctx.companyId,
        ...(search
          ? {
              OR: [
                { scopeName: { contains: search, mode: 'insensitive' } },
                { matchCode: { contains: search, mode: 'insensitive' } },
                { matchKeywords: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(divisionId ? { divisionId } : {}),
      },
      include: {
        division: { select: { id: true, name: true } },
        assumedTrade: { select: { id: true, name: true } },
      },
      orderBy: [{ division: { name: 'asc' } }, { scopeName: 'asc' }],
      take: 500,
    }),
    prisma.division.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.laborTrade.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return NextResponse.json({ items, divisions, trades });
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

  const created = await prisma.productivityEntry.create({
    data: { companyId: ctx.companyId, ...parsed },
  });
  return NextResponse.json(created, { status: 201 });
}
