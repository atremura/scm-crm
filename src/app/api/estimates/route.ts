import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'estimate', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const mine = searchParams.get('mine') === '1';
  const search = searchParams.get('search') || '';

  const where: any = { companyId: ctx.companyId };
  if (status && status !== 'all') where.status = status;
  if (mine) where.ownerId = ctx.userId;
  if (search) {
    where.OR = [
      { project: { name: { contains: search, mode: 'insensitive' } } },
      { project: { projectNumber: { contains: search, mode: 'insensitive' } } },
      { clientName: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const estimates = await prisma.estimate.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, projectNumber: true, address: true },
        },
        region: { select: { stateCode: true } },
        owner: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(estimates);
  } catch (err) {
    console.error('[estimates.GET]', err);
    return NextResponse.json({ error: 'Failed to list estimates' }, { status: 500 });
  }
}
