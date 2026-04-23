import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { saveProjectFile, StorageError } from '@/lib/storage';
import {
  VALID_PROJECT_DOCUMENT_TYPES,
  type ProjectDocumentType,
} from '@/lib/takeoff-utils';

// GET /api/projects/[id]/documents — list all documents for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const search = searchParams.get('search') || '';

  const where: any = { projectId: id };
  if (type && VALID_PROJECT_DOCUMENT_TYPES.includes(type as ProjectDocumentType)) {
    where.documentType = type;
  }
  if (search) {
    where.OR = [
      { fileName: { contains: search, mode: 'insensitive' } },
      { note: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const docs = await prisma.projectDocument.findMany({
      where,
      include: { uploader: { select: { id: true, name: true, email: true } } },
      orderBy: { uploadedAt: 'desc' },
    });
    return NextResponse.json(docs);
  } catch (err) {
    console.error('[project.docs.GET]', err);
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 });
  }
}

// POST /api/projects/[id]/documents — upload one file (multipart/form-data)
// Fields: file (required), documentType (optional, default 'other'), note
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
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file');
  const documentTypeRaw = (formData.get('documentType') as string | null) ?? 'other';
  const note = (formData.get('note') as string | null) ?? null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (!VALID_PROJECT_DOCUMENT_TYPES.includes(documentTypeRaw as ProjectDocumentType)) {
    return NextResponse.json(
      {
        error: `Invalid documentType. Allowed: ${VALID_PROJECT_DOCUMENT_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  let saved;
  try {
    saved = await saveProjectFile(file, id);
  } catch (err) {
    if (err instanceof StorageError) {
      const status = err.code === 'IO' ? 500 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('[project.docs.POST.save]', err);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }

  try {
    const doc = await prisma.projectDocument.create({
      data: {
        companyId: ctx.companyId,
        projectId: id,
        fileName: saved.fileName,
        fileUrl: saved.url,
        fileType: saved.fileType,
        fileSizeKb: saved.fileSizeKb,
        documentType: documentTypeRaw,
        note,
        uploadedBy: ctx.userId,
      },
      include: { uploader: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('[project.docs.POST.db]', err);
    return NextResponse.json({ error: 'Failed to record document' }, { status: 500 });
  }
}
