import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { saveFile, StorageError } from '@/lib/storage';
import { VALID_DOCUMENT_TYPES, type DocumentType } from '@/lib/bid-utils';

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
    const docs = await prisma.bidDocument.findMany({
      where: { bidId: id },
      orderBy: [{ addendumNumber: 'asc' }, { uploadedAt: 'asc' }],
    });
    return NextResponse.json(docs);
  } catch (err) {
    console.error('[bids.docs.GET]', err);
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 });
  }
}

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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file');
  const documentTypeRaw = (formData.get('documentType') as string | null) ?? 'other';
  const addendumRaw = formData.get('addendumNumber') as string | null;
  const replacesId = (formData.get('replacesId') as string | null) ?? null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  if (!VALID_DOCUMENT_TYPES.includes(documentTypeRaw as DocumentType)) {
    return NextResponse.json(
      { error: `Invalid documentType. Allowed: ${VALID_DOCUMENT_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  const addendumNumber = addendumRaw ? parseInt(addendumRaw, 10) : null;
  if (addendumRaw && Number.isNaN(addendumNumber)) {
    return NextResponse.json({ error: 'addendumNumber must be an integer' }, { status: 400 });
  }

  let saved;
  try {
    saved = await saveFile(file, id);
  } catch (err) {
    if (err instanceof StorageError) {
      const status = err.code === 'IO' ? 500 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('[bids.docs.POST.save]', err);
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }

  try {
    // Determine version. If replacing an existing doc, bump its version.
    let version = 1;
    if (replacesId) {
      const prev = await prisma.bidDocument.findUnique({
        where: { id: replacesId },
        select: { version: true, bidId: true },
      });
      if (prev && prev.bidId === id) {
        version = prev.version + 1;
      }
    }

    const doc = await prisma.bidDocument.create({
      data: {
        bidId: id,
        fileName: saved.fileName,
        fileUrl: saved.url,
        fileType: saved.fileType,
        fileSizeKb: saved.fileSizeKb,
        documentType: documentTypeRaw,
        addendumNumber: addendumNumber ?? undefined,
        version,
        replacedById: null,
      },
    });

    // If replacing, point the old doc's replacedById to the new one
    if (replacesId) {
      await prisma.bidDocument.update({
        where: { id: replacesId },
        data: { replacedById: doc.id },
      });
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('[bids.docs.POST.db]', err);
    return NextResponse.json({ error: 'Failed to record document' }, { status: 500 });
  }
}
