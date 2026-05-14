import type { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';

import { CoworkImportV1Schema, type CoworkImportV1 } from './schema';
import { validateIntegrity, type IntegrityViolation } from './integrity-rules';
import { checkTenantSlugMatch } from './tenant-rule';
import { computeFileHash } from './compute-file-hash';

/**
 * Discriminated result of an import preview operation.
 *
 * The route handler maps each kind to an HTTP status:
 *
 *   kind                  HTTP    EstimateImport persisted?
 *   ----                  ----    -------------------------
 *   success               200     yes (status='previewed')
 *   validation_failed     422     yes (status='failed')
 *   zod_failed            400     no
 *   conflict              409     no (existing import returned)
 *   tenant_not_found      500     no (data inconsistency)
 */
export type ImportPreviewResult =
  | {
      kind: 'success';
      importId: string;
      status: 'previewed';
      summary: PreviewSummary;
      warnings: IntegrityViolation[];
    }
  | {
      kind: 'validation_failed';
      importId: string;
      status: 'failed';
      blockers: IntegrityViolation[];
      warnings: IntegrityViolation[];
    }
  | {
      kind: 'zod_failed';
      zodErrors: ReturnType<ZodError['flatten']>;
    }
  | {
      kind: 'conflict';
      existingImportId: string;
      existingStatus: string;
    }
  | {
      kind: 'tenant_not_found';
      companyId: string;
    };

/**
 * Summary computed from a successfully validated payload, displayed
 * to the user in the preview UI.
 */
export type PreviewSummary = {
  projectName: string;
  estimateType: string;
  scopeItemsCount: number;
  takeoffItemsCount: number;
  materialsCount: number;
  laborProductivityCount: number;
  scenariosCount: number;
  recommendedScenarioCode: string;
  totalBidPrice: number;
};

export type ImportPreviewInput = {
  projectId: string;
  companyId: string;
  userId: string;
  fileName: string;
  rawJsonString: string;
};

/**
 * Orchestrates the import preview pipeline. Pure logic plus database
 * access via injected Prisma client (no HTTP, no NextAuth).
 *
 *   1. Parse Zod  -> zod_failed if invalid
 *   2. Compute file hash
 *   3. Idempotency check -> conflict if existing
 *   4. Fetch Company.slug -> tenant_not_found if missing
 *   5. Rule 8 (tenant_slug match)
 *   6. validateIntegrity (7 pure rules)
 *   7. Persist EstimateImport (previewed or failed)
 *   8. Return discriminated result
 */
export async function previewImport(
  prisma: PrismaClient,
  input: ImportPreviewInput,
): Promise<ImportPreviewResult> {
  // Step 1: Zod parse
  const parseResult = CoworkImportV1Schema.safeParse(JSON.parse(input.rawJsonString));

  if (!parseResult.success) {
    return {
      kind: 'zod_failed',
      zodErrors: parseResult.error.flatten(),
    };
  }

  const payload: CoworkImportV1 = parseResult.data;

  // Step 2: file hash (deterministic — caller-supplied raw string)
  const fileHash = computeFileHash(input.rawJsonString);

  // Step 3: idempotency check
  const existing = await prisma.estimateImport.findUnique({
    where: {
      projectId_fileHash: {
        projectId: input.projectId,
        fileHash,
      },
    },
  });

  if (existing) {
    return {
      kind: 'conflict',
      existingImportId: existing.id,
      existingStatus: existing.status,
    };
  }

  // Step 4: fetch company slug for Rule 8
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { slug: true },
  });

  if (!company) {
    return {
      kind: 'tenant_not_found',
      companyId: input.companyId,
    };
  }

  // Step 5 & 6: run all integrity rules (1-7 from validator + Rule 8)
  const integrityResult = validateIntegrity(payload);
  const tenantViolation = checkTenantSlugMatch(
    payload.estimate_meta.tenant_slug ?? null,
    company.slug,
  );

  const allBlockers = [
    ...integrityResult.blockers,
    ...(tenantViolation && tenantViolation.severity === 'BLOCKER' ? [tenantViolation] : []),
  ];

  const allWarnings = integrityResult.warnings;

  // Step 7: persist (BLOCKER -> failed, no BLOCKER -> previewed)
  const isSuccess = allBlockers.length === 0;
  const status = isSuccess ? 'previewed' : 'failed';

  const summary: PreviewSummary | null = isSuccess ? buildSummary(payload) : null;

  const previewSummaryJson = isSuccess
    ? {
        summary,
        warnings: allWarnings,
      }
    : {
        blockers: allBlockers,
        warnings: allWarnings,
      };

  const created = await prisma.estimateImport.create({
    data: {
      companyId: input.companyId,
      projectId: input.projectId,
      schemaVersion: payload.schema_version,
      fileName: input.fileName,
      fileHash,
      status,
      rawPayload: payload as unknown as object,
      previewSummary: previewSummaryJson as unknown as object,
    },
    select: {
      id: true,
    },
  });

  // Step 8: build discriminated result
  if (isSuccess && summary !== null) {
    return {
      kind: 'success',
      importId: created.id,
      status: 'previewed',
      summary,
      warnings: allWarnings,
    };
  }

  return {
    kind: 'validation_failed',
    importId: created.id,
    status: 'failed',
    blockers: allBlockers,
    warnings: allWarnings,
  };
}

/**
 * Computes the preview summary from a validated payload. Internal
 * helper, exported only for testing.
 */
export function buildSummary(payload: CoworkImportV1): PreviewSummary {
  return {
    projectName: payload.estimate_meta.project_name,
    estimateType: payload.estimate_meta.estimate_type,
    scopeItemsCount: payload.scope_items.length,
    takeoffItemsCount: payload.takeoff_items.length,
    materialsCount: payload.materials.length,
    laborProductivityCount: payload.labor_productivity.length,
    scenariosCount: payload.scenarios.length,
    recommendedScenarioCode: payload.summary.recommended_scenario_code,
    totalBidPrice: payload.summary.total_bid_price,
  };
}
