import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { VALID_PROJECT_STATUSES } from '@/lib/takeoff-utils';
import { deleteFile } from '@/lib/storage';

const patchProjectSchema = z
  .object({
    name: z.string().min(3).optional(),
    projectNumber: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    workType: z.string().nullable().optional(),
    clientId: z.string().uuid().nullable().optional(),
    estimatorId: z.string().uuid().nullable().optional(),
    notes: z.string().nullable().optional(),
    status: z.enum(VALID_PROJECT_STATUSES).optional(),
  })
  .strict();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const project = await prisma.project.findFirst({
      where: { id, companyId: ctx.companyId },
      include: {
        client: {
          include: { contacts: { where: { isPrimary: true }, take: 1 } },
        },
        bid: {
          select: {
            id: true,
            bidNumber: true,
            status: true,
            projectName: true,
            responseDeadline: true,
          },
        },
        estimator: { select: { id: true, name: true, email: true } },
        sentToEstimateBy: { select: { id: true, name: true } },
        estimateReceiver: { select: { id: true, name: true, email: true } },
        documents: {
          orderBy: { uploadedAt: 'desc' },
          include: { uploader: { select: { id: true, name: true } } },
        },
        classifications: {
          orderBy: { createdAt: 'asc' },
          include: { template: { select: { id: true, name: true } } },
        },
        imports: {
          orderBy: { importedAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json(project);
  } catch (err) {
    console.error('[projects.[id].GET]', err);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  let parsed;
  try {
    const body = await req.json();
    parsed = patchProjectSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  const existing = await prisma.project.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Verify tenant ownership of referenced records when being changed
  if (parsed.clientId !== undefined && parsed.clientId !== null) {
    const c = await prisma.client.findFirst({
      where: { id: parsed.clientId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!c) return NextResponse.json({ error: 'Client not found' }, { status: 400 });
  }
  if (parsed.estimatorId !== undefined && parsed.estimatorId !== null) {
    const u = await prisma.user.findFirst({
      where: { id: parsed.estimatorId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!u) return NextResponse.json({ error: 'Estimator not found' }, { status: 400 });
  }

  const data: any = { ...parsed };
  if (parsed.status === 'archived' && existing.status !== 'archived') {
    data.archivedAt = new Date();
  } else if (parsed.status === 'active' && existing.status === 'archived') {
    data.archivedAt = null;
  }

  try {
    const updated = await prisma.project.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, companyName: true } },
        estimator: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[projects.[id].PATCH]', err);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

/**
 * Hard-delete a project, its documents, classifications, and import audit.
 * Files in blob/local storage are best-effort deleted first — if cleanup
 * fails for a file we log and continue so the DB stays consistent.
 *
 * Archive (soft) is available via PATCH { status: 'archived' }.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'delete'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.project.findFirst({
    where: { id, companyId: ctx.companyId },
    select: {
      id: true,
      documents: { select: { fileUrl: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Best-effort file cleanup — don't block the DB delete if one fails.
  await Promise.allSettled(
    existing.documents.map((d) =>
      deleteFile(d.fileUrl).catch((err) => {
        console.warn('[projects.[id].DELETE] file cleanup failed', d.fileUrl, err);
      })
    )
  );

  try {
    // DB cascade removes ProjectDocument, Classification, TakeoffImport rows.
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[projects.[id].DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
