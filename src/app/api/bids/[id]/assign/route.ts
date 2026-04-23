import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

const assignSchema = z.object({
  userId: z.string().uuid(),
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
    parsed = assignSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  const bid = await prisma.bid.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });

  if (bid.status !== 'qualified') {
    return NextResponse.json(
      { error: 'Bid must be in "qualified" status to be assigned to Takeoff' },
      { status: 400 }
    );
  }

  const assignee = await prisma.user.findFirst({
    where: { id: parsed.userId, companyId: ctx.companyId },
  });
  if (!assignee || !assignee.isActive) {
    return NextResponse.json({ error: 'Assignee not found or inactive' }, { status: 400 });
  }

  try {
    const [updated] = await prisma.$transaction([
      prisma.bid.update({
        where: { id },
        data: { assignedTo: parsed.userId, status: 'sent_to_takeoff' },
      }),
      prisma.bidStatusHistory.create({
        data: {
          bidId: id,
          changedBy: ctx.userId,
          fromStatus: bid.status,
          toStatus: 'sent_to_takeoff',
          notes:
            parsed.notes ??
            `Assigned to ${assignee.name} <${assignee.email}> for takeoff`,
        },
      }),
    ]);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[bids.assign.POST]', err);
    return NextResponse.json({ error: 'Failed to assign bid' }, { status: 500 });
  }
}
