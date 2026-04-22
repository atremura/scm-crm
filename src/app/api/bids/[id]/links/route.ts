import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

const createLinkSchema = z.object({
  url: z.string().url(),
  label: z.string().nullable().optional(),
  category: z.enum(['documents', 'portal', 'meeting', 'addendum', 'other']).optional(),
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
  const bid = await prisma.bid.findUnique({ where: { id }, select: { id: true } });
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });

  let parsed;
  try {
    const body = await req.json();
    parsed = createLinkSchema.parse(body);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload' },
      { status: 400 }
    );
  }

  try {
    const link = await prisma.bidLink.create({
      data: {
        bidId: id,
        url: parsed.url,
        label: parsed.label ?? null,
        category: parsed.category ?? 'other',
        source: 'manual',
      },
    });
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    console.error('[bids.links.POST]', err);
    return NextResponse.json({ error: 'Failed to add link' }, { status: 500 });
  }
}
