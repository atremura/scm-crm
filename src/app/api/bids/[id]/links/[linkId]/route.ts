import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, linkId } = await params;
  const link = await prisma.bidLink.findFirst({
    where: { id: linkId, companyId: ctx.companyId, bidId: id },
  });
  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }

  try {
    await prisma.bidLink.delete({ where: { id: linkId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[bids.links.DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
  }
}
