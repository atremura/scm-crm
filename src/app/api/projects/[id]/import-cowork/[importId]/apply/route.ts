import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth, canDo } from '@/lib/permissions';
import { applyImport } from '@/lib/cowork-import';

type RouteContext = {
  params: Promise<{ id: string; importId: string }>;
};

/**
 * POST /api/projects/[id]/import-cowork/[importId]/apply
 *
 * Applies a previewed EstimateImport to the project, creating Estimate,
 * Classifications, and EstimateLines from the Cowork payload.
 *
 * Pre-conditions:
 *   - Import status MUST be 'previewed' (not 'failed', 'applied', etc)
 *   - Project must have NO existing Estimate
 *   - Project status in ['active', 'sent_to_estimate']
 *   - Tenant must have a default Region configured
 *
 * Requires estimate.edit permission.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const ctx = await requireAuth();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowed = await canDo(ctx, 'estimate', 'edit');
  if (!allowed) {
    return NextResponse.json(
      { error: 'Forbidden: missing estimate.edit permission' },
      { status: 403 },
    );
  }

  const { id: projectId, importId } = await context.params;

  // Project IDOR check (apply-service also does it, but fail fast here)
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: ctx.companyId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const result = await applyImport(prisma, {
    importId,
    projectId,
    companyId: ctx.companyId,
    userId: ctx.userId,
  });

  switch (result.kind) {
    case 'success':
      return NextResponse.json(
        {
          estimateId: result.estimateId,
          classificationsCount: result.classificationsCount,
          linesCount: result.linesCount,
        },
        { status: 200 },
      );

    case 'import_not_found':
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });

    case 'wrong_import_status':
      return NextResponse.json(
        {
          error: `Import cannot be applied (current status: ${result.currentStatus}). Only 'previewed' imports can be applied.`,
          currentStatus: result.currentStatus,
        },
        { status: 422 },
      );

    case 'wrong_project_status':
      return NextResponse.json(
        {
          error: `Project status '${result.currentStatus}' does not allow import apply. Project must be 'active' or 'sent_to_estimate'.`,
          currentStatus: result.currentStatus,
        },
        { status: 422 },
      );

    case 'estimate_exists':
      return NextResponse.json(
        {
          error:
            'Project already has an Estimate. Delete the existing Estimate before applying a Cowork import.',
          existingEstimateId: result.existingEstimateId,
        },
        { status: 409 },
      );

    case 'no_default_region':
      return NextResponse.json(
        {
          error:
            'No default region configured for this company. Seed the productivity database first.',
        },
        { status: 400 },
      );

    case 'corrupt_payload':
      return NextResponse.json(
        {
          error:
            'Stored payload no longer matches Cowork schema. The import is corrupt and cannot be applied.',
          details: result.details,
        },
        { status: 500 },
      );

    default: {
      const _exhaustive: never = result;
      void _exhaustive;
      return NextResponse.json({ error: 'Unexpected service result' }, { status: 500 });
    }
  }
}
