import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

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
