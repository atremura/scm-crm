import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/permissions';
import { saveCompanyLogo, deleteFile, StorageError } from '@/lib/storage';

export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  let saved;
  try {
    saved = await saveCompanyLogo(file, ctx.companyId);
  } catch (err) {
    if (err instanceof StorageError) {
      const status = err.code === 'IO' ? 500 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('[company.logo.POST.save]', err);
    return NextResponse.json({ error: 'Failed to save logo' }, { status: 500 });
  }

  // Replace any previous logo
  const existing = await prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { logoUrl: true },
  });
  if (existing?.logoUrl) {
    deleteFile(existing.logoUrl).catch((e) =>
      console.error('[company.logo] failed to delete previous', e),
    );
  }

  const updated = await prisma.company.update({
    where: { id: ctx.companyId },
    data: { logoUrl: saved.url },
    select: { logoUrl: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE() {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existing = await prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { logoUrl: true },
  });
  if (existing?.logoUrl) {
    deleteFile(existing.logoUrl).catch((e) => console.error('[company.logo.DELETE]', e));
  }
  await prisma.company.update({
    where: { id: ctx.companyId },
    data: { logoUrl: null },
  });
  return NextResponse.json({ logoUrl: null });
}
