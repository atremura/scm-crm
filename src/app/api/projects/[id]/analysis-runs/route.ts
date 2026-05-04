import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';

/**
 * GET /api/projects/[id]/analysis-runs
 *
 * Lists every ProjectAnalysisRun for a project, newest first. Skinny
 * shape — no parsedResult/responsePayload (those load via /[runId]).
 *
 * Permissions: takeoff/view. Tenant-scoped.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'takeoff', 'view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: projectId } = await params;

  // Project ownership / tenant check
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const runs = await prisma.projectAnalysisRun.findMany({
    where: { projectId, companyId: ctx.companyId },
    orderBy: { createdAt: 'desc' },
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
      errorMessage: true,
      reviewedAt: true,
      reviewer: { select: { id: true, name: true } },
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(runs);
}
