import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

/**
 * GET /api/projects/[id]/analysis-runs/[runId]
 *
 * Full payload of a single run — including parsedResult (for the
 * drawer) and responsePayload (for debugging). RequestPayload + raw
 * response can balloon to MBs on a 50-page PDF run, so we only ship
 * them when ?include=raw is explicitly set.
 *
 * Permissions: takeoff/view. Tenant-scoped.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: projectId, runId } = await params;
  const url = new URL(req.url);
  const includeRaw = url.searchParams.get('include') === 'raw';

  const run = await prisma.projectAnalysisRun.findFirst({
    where: {
      id: runId,
      projectId,
      companyId: ctx.companyId,
    },
    select: {
      id: true,
      modelUsed: true,
      promptVersion: true,
      status: true,
      itemsProposed: true,
      itemsAccepted: true,
      itemsRejected: true,
      costCents: true,
      inputTokens: true,
      outputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
      documentIds: true,
      parsedResult: true,
      errorMessage: true,
      reviewedAt: true,
      reviewer: { select: { id: true, name: true } },
      reviewNote: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      // Raw payloads — only on demand
      requestPayload: includeRaw,
      responsePayload: includeRaw,
    },
  });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  // Hydrate document file metadata so the drawer can render PDF links
  // alongside source_reference values.
  const documents = await prisma.projectDocument.findMany({
    where: {
      id: { in: run.documentIds },
      companyId: ctx.companyId,
    },
    select: { id: true, fileName: true, fileUrl: true, documentType: true },
  });

  return NextResponse.json({ ...run, documents });
}
