import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { deleteFile } from '@/lib/storage';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, documentId } = await params;

  const doc = await prisma.bidDocument.findUnique({ where: { id: documentId } });
  if (!doc || doc.bidId !== id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  try {
    await prisma.bidDocument.delete({ where: { id: documentId } });
    await deleteFile(doc.fileUrl);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[bids.docs.DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
