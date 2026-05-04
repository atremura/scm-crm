import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { startScopeAnalysis } from '@/lib/ai/scope-analyst';

const bodySchema = z
  .object({
    documentIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

/**
 * POST /api/projects/[id]/analyze
 *
 * Triggers the AI scope-analyst pipeline for a project.
 *
 * Body (optional): { documentIds: string[] }
 *   When omitted, defaults to every ProjectDocument with
 *   documentType IN ('plans', 'specs', 'addendum').
 *
 * Response: { runId, status, itemsProposed, costCents }
 *
 * Permissions: takeoff/edit. Tenant isolation enforced via companyId.
 *
 * This is a long-running endpoint — Opus 4.7 takes 90–180s on large
 * projects. The handler does NOT stream; the client should disable
 * the trigger button and poll GET /analysis-runs for status updates.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: projectId } = await params;

  // Tenant + project sanity check.
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Parse body — both shape errors and an empty body land here.
  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw = await req.json().catch(() => ({})); // empty body is fine, treated as defaults
    parsed = bodySchema.parse(raw);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.errors?.[0]?.message ?? 'Invalid payload' },
      { status: 400 },
    );
  }

  // Resolve document selection: explicit list, or default to plans/specs/addendum.
  let documentIds = parsed.documentIds ?? [];
  if (documentIds.length === 0) {
    const defaults = await prisma.projectDocument.findMany({
      where: {
        projectId,
        companyId: ctx.companyId,
        documentType: { in: ['plans', 'specs', 'addendum'] },
      },
      select: { id: true },
      orderBy: { uploadedAt: 'asc' },
    });
    documentIds = defaults.map((d) => d.id);
  }
  if (documentIds.length === 0) {
    return NextResponse.json(
      {
        error:
          'No documents to analyze. Upload at least one plans / specs PDF, or pass documentIds explicitly.',
      },
      { status: 400 },
    );
  }

  // Per-file size guard. Anthropic Files API caps individual uploads
  // at 500 MB. The 32 MB request body limit no longer applies because
  // we reference each PDF by file_id (not inlined). Page count is the
  // remaining constraint: 600 pages per request with Opus 4.7 (1M ctx).
  const FILES_API_PER_FILE_LIMIT_BYTES = 500 * 1024 * 1024;
  const oversized = await prisma.projectDocument.findMany({
    where: {
      id: { in: documentIds },
      projectId,
      companyId: ctx.companyId,
      fileSizeKb: { gt: FILES_API_PER_FILE_LIMIT_BYTES / 1024 },
    },
    select: { id: true, fileName: true, fileSizeKb: true },
  });
  if (oversized.length > 0) {
    const breakdown = oversized
      .map((d) => `  ${d.fileName} — ${((d.fileSizeKb ?? 0) / 1024).toFixed(1)} MB`)
      .join('\n');
    return NextResponse.json(
      {
        error: `Some documents exceed the Anthropic Files API per-file cap of 500 MB:\n${breakdown}`,
        oversized: oversized.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          sizeMb: ((d.fileSizeKb ?? 0) / 1024).toFixed(1),
        })),
      },
      { status: 413 },
    );
  }

  // Fire-and-forget. startScopeAnalysis creates the run row + kicks
  // off the background worker, then returns the runId. The frontend
  // polls GET /analysis-runs/[runId] for completion.
  try {
    const result = await startScopeAnalysis({
      companyId: ctx.companyId,
      projectId,
      documentIds,
    });
    return NextResponse.json(result, { status: 202 });
  } catch (err: any) {
    console.error('[projects.analyze.POST]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to start scope analysis' },
      { status: 500 },
    );
  }
}
