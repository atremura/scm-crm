import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { VALID_PRIORITIES } from '@/lib/bid-utils';

const patchBidSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    projectName: z.string().min(3).optional(),
    projectAddress: z.string().nullable().optional(),
    workType: z.string().nullable().optional(),
    receivedDate: z.string().datetime().nullable().optional(),
    responseDeadline: z.string().datetime().nullable().optional(),
    priority: z.enum(VALID_PRIORITIES).optional(),
    notes: z.string().nullable().optional(),
    bondRequired: z.boolean().optional(),
    unionJob: z.boolean().optional(),
    prevailingWage: z.boolean().optional(),
    davisBacon: z.boolean().optional(),
    insuranceRequirements: z.string().nullable().optional(),
  })
  .strict();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const bid = await prisma.bid.findFirst({
      where: { id, companyId: ctx.companyId },
      include: {
        client: { include: { contacts: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        documents: { orderBy: [{ addendumNumber: 'asc' }, { uploadedAt: 'asc' }] },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        aiAnalysis: { orderBy: { analyzedAt: 'desc' } },
        links: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    return NextResponse.json(bid);
  } catch (err) {
    console.error('[bids.[id].GET]', err);
    return NextResponse.json({ error: 'Failed to fetch bid' }, { status: 500 });
  }
}

export async function PATCH(
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
    parsed = patchBidSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  const existing = await prisma.bid.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });

  // If client is being changed, verify it belongs to the same company
  if (parsed.clientId && parsed.clientId !== existing.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: parsed.clientId, companyId: ctx.companyId },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 400 });
    }
  }

  const data: any = { ...parsed };
  if (parsed.receivedDate !== undefined) {
    data.receivedDate = parsed.receivedDate ? new Date(parsed.receivedDate) : null;
  }
  if (parsed.responseDeadline !== undefined) {
    data.responseDeadline = parsed.responseDeadline
      ? new Date(parsed.responseDeadline)
      : null;
  }

  try {
    const updated = await prisma.bid.update({
      where: { id },
      data,
      include: { client: true, assignedUser: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[bids.[id].PATCH]', err);
    return NextResponse.json({ error: 'Failed to update bid' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'delete'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.bid.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });

  try {
    await prisma.$transaction([
      prisma.bid.update({
        where: { id },
        data: { status: 'rejected' },
      }),
      prisma.bidStatusHistory.create({
        data: {
          bidId: id,
          changedBy: ctx.userId,
          fromStatus: existing.status,
          toStatus: 'rejected',
          notes: 'Soft-deleted via DELETE endpoint',
        },
      }),
    ]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[bids.[id].DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete bid' }, { status: 500 });
  }
}
