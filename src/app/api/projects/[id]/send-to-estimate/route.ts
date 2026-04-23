import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

/**
 * Handoff from Takeoff → Estimate.
 *
 * When the estimator finishes measuring and wants to kick the project
 * over to proposal-building, they POST here. We:
 *   - stamp the project with who sent it + when + optional note,
 *   - assign the receiver (often a different user once the team grows;
 *     may be the same person for one-estimator shops),
 *   - move status to 'sent_to_estimate'.
 *
 * When the Estimate module lands, an accept endpoint will flip status
 * to 'estimate_accepted' and create the real Estimate record.
 */
const bodySchema = z.object({
  receiverId: z.string().uuid(),
  note: z.string().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { id: true, status: true, _count: { select: { classifications: true } } },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  if (project._count.classifications === 0) {
    return NextResponse.json(
      { error: 'Cannot send an empty takeoff. Add at least one classification first.' },
      { status: 400 }
    );
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = bodySchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  const receiver = await prisma.user.findFirst({
    where: { id: parsed.receiverId, companyId: ctx.companyId, isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!receiver) {
    return NextResponse.json({ error: 'Receiver not found or inactive' }, { status: 400 });
  }

  try {
    const updated = await prisma.project.update({
      where: { id },
      data: {
        status: 'sent_to_estimate',
        sentToEstimateAt: new Date(),
        sentToEstimateById: ctx.userId,
        estimateReceiverId: parsed.receiverId,
        estimateHandoffNote: parsed.note ?? null,
        // Clear any prior acceptance if this is a re-send.
        estimateAcceptedAt: null,
      },
      include: {
        sentToEstimateBy: { select: { id: true, name: true } },
        estimateReceiver: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[projects.send-to-estimate.POST]', err);
    return NextResponse.json(
      { error: 'Failed to send project to Estimate' },
      { status: 500 }
    );
  }
}
