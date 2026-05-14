import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth, canDo } from '@/lib/permissions';

type RouteContext = {
  params: Promise<{ id: string; importId: string }>;
};

/**
 * GET /api/projects/[id]/import-cowork/[importId]
 *
 * Returns full detail of a single EstimateImport including rawPayload
 * (useful for UI drill-down into scope_items, takeoffs, materials, etc).
 *
 * Read-only — requires estimate.view permission.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const ctx = await requireAuth();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowed = await canDo(ctx, 'estimate', 'view');
  if (!allowed) {
    return NextResponse.json(
      { error: 'Forbidden: missing estimate.view permission' },
      { status: 403 },
    );
  }

  const { id: projectId, importId } = await context.params;

  // Project IDOR check
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: ctx.companyId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const importRow = await prisma.estimateImport.findFirst({
    where: {
      id: importId,
      projectId,
      companyId: ctx.companyId,
    },
  });

  if (!importRow) {
    return NextResponse.json({ error: 'Import not found' }, { status: 404 });
  }

  return NextResponse.json({ import: importRow }, { status: 200 });
}
