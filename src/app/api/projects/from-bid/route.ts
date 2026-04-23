import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

const fromBidSchema = z.object({
  bidId: z.string().uuid(),
  estimatorId: z.string().uuid().optional().nullable(),
  transitionBid: z.boolean().default(true), // also move bid → sent_to_takeoff
});

/**
 * POST /api/projects/from-bid
 *
 * Spin up a Takeoff Project seeded from a qualified Bid. Snapshots the
 * bid's client, address, work type, and name onto the Project so later
 * edits on the Bid don't mutate the Project. Optionally transitions the
 * Bid to `sent_to_takeoff` in the same transaction.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = fromBidSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  const bid = await prisma.bid.findFirst({
    where: { id: parsed.bidId, companyId: ctx.companyId },
    include: {
      client: { select: { id: true, companyName: true } },
    },
  });
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });

  if (bid.status !== 'qualified' && bid.status !== 'sent_to_takeoff') {
    return NextResponse.json(
      { error: 'Only qualified bids can be moved to takeoff' },
      { status: 400 }
    );
  }

  if (parsed.estimatorId) {
    const u = await prisma.user.findFirst({
      where: { id: parsed.estimatorId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!u) return NextResponse.json({ error: 'Estimator not found' }, { status: 400 });
  }

  try {
    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          companyId: ctx.companyId,
          bidId: bid.id,
          clientId: bid.clientId,
          estimatorId: parsed.estimatorId ?? bid.assignedTo ?? null,
          name: bid.projectName,
          address: bid.projectAddress,
          workType: bid.workType,
          status: 'active',
        },
      });

      if (parsed.transitionBid && bid.status === 'qualified') {
        await tx.bid.update({
          where: { id: bid.id },
          data: { status: 'sent_to_takeoff' },
        });
        await tx.bidStatusHistory.create({
          data: {
            bidId: bid.id,
            changedBy: ctx.userId,
            fromStatus: 'qualified',
            toStatus: 'sent_to_takeoff',
            notes: `Takeoff project created: ${p.name}`,
          },
        });
      }

      return p;
    });

    const hydrated = await prisma.project.findFirst({
      where: { id: project.id, companyId: ctx.companyId },
      include: {
        client: { select: { id: true, companyName: true } },
        bid: { select: { id: true, bidNumber: true, status: true } },
        estimator: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(hydrated, { status: 201 });
  } catch (err) {
    console.error('[projects.from-bid.POST]', err);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
