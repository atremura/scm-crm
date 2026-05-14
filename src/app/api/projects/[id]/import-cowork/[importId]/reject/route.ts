import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth, canDo } from '@/lib/permissions';
import { rejectImport } from '@/lib/cowork-import';

type RouteContext = {
  params: Promise<{ id: string; importId: string }>;
};

/**
 * POST /api/projects/[id]/import-cowork/[importId]/reject
 *
 * Marks a previewed or failed EstimateImport as rejected with an audit
 * trail (rejectedBy, rejectedAt, rejectionReason).
 *
 * Body: { rejectionReason: string } (min 10 chars after trim)
 *
 * Requires estimate.edit permission.
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

  // Parse body
  let body: { rejectionReason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rejectionReason = body.rejectionReason ?? '';
  if (typeof rejectionReason !== 'string') {
    return NextResponse.json({ error: 'rejectionReason must be a string' }, { status: 400 });
  }

  // Project IDOR check
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: ctx.companyId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const result = await rejectImport(prisma, {
    importId,
    projectId,
    companyId: ctx.companyId,
    userId: ctx.userId,
    rejectionReason,
  });

  switch (result.kind) {
    case 'success':
      return NextResponse.json({ importId: result.importId, status: 'rejected' }, { status: 200 });

    case 'import_not_found':
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });

    case 'wrong_import_status':
      return NextResponse.json(
        {
          error: `Import cannot be rejected (current status: ${result.currentStatus}). Only 'previewed' or 'failed' imports can be rejected.`,
          currentStatus: result.currentStatus,
        },
        { status: 422 },
      );

    case 'reason_too_short':
      return NextResponse.json(
        {
          error: `rejectionReason must be at least ${result.minLength} characters (after trim).`,
          minLength: result.minLength,
        },
        { status: 400 },
      );

    default: {
      const _exhaustive: never = result;
      void _exhaustive;
      return NextResponse.json({ error: 'Unexpected service result' }, { status: 500 });
    }
  }
}
