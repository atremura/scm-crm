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
  if (!(await canDo(ctx, 'takeoff', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, documentId } = await params;

  // Confirm project belongs to this tenant
  const project = await prisma.project.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const doc = await prisma.projectDocument.findFirst({
    where: { id: documentId, projectId: id, companyId: ctx.companyId },
  });
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  try {
    // DB first, then file — if DB deletes, the file is orphaned which is
    // safer than a ghost row whose file no longer exists.
    await prisma.projectDocument.delete({ where: { id: documentId } });
    try {
      await deleteFile(doc.fileUrl);
    } catch (err) {
      console.warn('[project.docs.DELETE] file cleanup failed', doc.fileUrl, err);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[project.docs.DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
