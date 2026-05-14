import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAuth, canDo } from '@/lib/permissions';
import { previewImport } from '@/lib/cowork-import';

/**
 * Maximum body size accepted, in bytes. Cowork payloads typically
 * range 40-60 KB; 1 MB gives generous headroom while preventing
 * obvious DoS.
 */
const MAX_BODY_BYTES = 1_048_576; // 1 MiB

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/projects/[id]/import-cowork
 *
 * Preview a Cowork-generated estimate JSON before applying it to the
 * project. The endpoint validates the payload against Zod schema and
 * 8 integrity rules, then persists an EstimateImport row capturing
 * the outcome.
 *
 * On BLOCKER, the row is persisted with status='failed' (audit trail)
 * and the endpoint returns 422 with the violations.
 *
 * Idempotency: the same JSON content (by SHA-256 hash) cannot be
 * imported twice to the same project — the second attempt returns
 * 409 Conflict referencing the existing import.
 *
 * See docs/cowork-import-schema.md for the payload contract.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // 1. Auth
  const ctx = await requireAuth();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Permission
  const allowed = await canDo(ctx, 'estimate', 'create');
  if (!allowed) {
    return NextResponse.json(
      { error: 'Forbidden: missing estimate.create permission' },
      { status: 403 },
    );
  }

  // 3. Resolve params (Next.js 16 — async params)
  const { id: projectId } = await context.params;

  // 4. Project lookup scoped to tenant (prevents IDOR cross-tenant)
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId: ctx.companyId,
    },
    select: { id: true },
  });

  if (!project) {
    // 404 even if project exists in another tenant — don't leak existence.
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // 5. Read raw body as text (we need the raw string for SHA-256)
  let rawJsonString: string;
  try {
    rawJsonString = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  if (rawJsonString.length === 0) {
    return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
  }

  if (rawJsonString.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'Request body too large', maxBytes: MAX_BODY_BYTES },
      { status: 413 },
    );
  }

  // 6. Validate JSON parsability (Zod parsing happens inside service)
  try {
    JSON.parse(rawJsonString);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 7. File name from header (optional, defaults to 'import.json')
  const fileNameHeader = request.headers.get('x-file-name');
  const fileName =
    fileNameHeader && fileNameHeader.length > 0 ? fileNameHeader.slice(0, 255) : 'import.json';

  // 8. Delegate to service
  const result = await previewImport(prisma, {
    projectId,
    companyId: ctx.companyId,
    userId: ctx.userId,
    fileName,
    rawJsonString,
  });

  // 9. Map service result to HTTP response
  switch (result.kind) {
    case 'success':
      return NextResponse.json(
        {
          importId: result.importId,
          status: result.status,
          summary: result.summary,
          warnings: result.warnings,
        },
        { status: 200 },
      );

    case 'validation_failed':
      return NextResponse.json(
        {
          importId: result.importId,
          status: result.status,
          blockers: result.blockers,
          warnings: result.warnings,
        },
        { status: 422 },
      );

    case 'zod_failed':
      return NextResponse.json(
        {
          error: 'Payload does not match Cowork schema v1.0.0',
          zodErrors: result.zodErrors,
        },
        { status: 400 },
      );

    case 'conflict':
      return NextResponse.json(
        {
          error: 'This file has already been imported to this project',
          existingImportId: result.existingImportId,
          existingStatus: result.existingStatus,
        },
        { status: 409 },
      );

    case 'tenant_not_found':
      // Data inconsistency — auth said companyId X but Company X is gone.
      return NextResponse.json({ error: 'Internal error: tenant record missing' }, { status: 500 });

    default: {
      // Exhaustiveness check — TS will error if a new kind is added
      // without a corresponding case here.
      const _exhaustive: never = result;
      void _exhaustive;
      return NextResponse.json({ error: 'Unexpected service result' }, { status: 500 });
    }
  }
}

/**
 * GET /api/projects/[id]/import-cowork
 *
 * Lists all EstimateImport rows for a project, ordered by createdAt DESC.
 * Read-only — requires estimate.view permission.
 *
 * Returns metadata only (no rawPayload) to keep payload light.
 * For full payload of a single import, use GET /import-cowork/[importId].
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

  const { id: projectId } = await context.params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: ctx.companyId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const imports = await prisma.estimateImport.findMany({
    where: { projectId, companyId: ctx.companyId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      schemaVersion: true,
      fileName: true,
      fileHash: true,
      status: true,
      estimateId: true,
      appliedById: true,
      appliedAt: true,
      rejectedById: true,
      rejectedAt: true,
      rejectionReason: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ imports }, { status: 200 });
}
