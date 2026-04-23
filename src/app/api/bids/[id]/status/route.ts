import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import {
  isValidTransition,
  VALID_STATUSES,
  type BidStatus,
} from '@/lib/bid-utils';

const changeStatusSchema = z.object({
  newStatus: z.enum(VALID_STATUSES),
  notes: z.string().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let parsed;
  try {
    const body = await req.json();
    parsed = changeStatusSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  const bid = await prisma.bid.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });

  const from = bid.status as BidStatus;
  const to = parsed.newStatus as BidStatus;

  if (from === to) {
    return NextResponse.json({ error: 'Bid is already in that status' }, { status: 400 });
  }

  if (!isValidTransition(from, to)) {
    return NextResponse.json(
      { error: `Invalid transition: ${from} → ${to}` },
      { status: 400 }
    );
  }

  try {
    const [updated] = await prisma.$transaction([
      prisma.bid.update({
        where: { id },
        data: { status: to },
      }),
      prisma.bidStatusHistory.create({
        data: {
          bidId: id,
          changedBy: ctx.userId,
          fromStatus: from,
          toStatus: to,
          notes: parsed.notes ?? null,
        },
      }),
    ]);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[bids.status.POST]', err);
    return NextResponse.json({ error: 'Failed to change status' }, { status: 500 });
  }
}
