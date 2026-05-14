import type { PrismaClient } from '@prisma/client';
import type { ZodError } from 'zod';

import { CoworkImportV1Schema, type CoworkImportV1 } from './schema';

/**
 * Discriminated result of an import APPLY operation.
 *
 * The route handler maps each kind to an HTTP status:
 *
 *   kind                    HTTP    What happened?
 *   ----                    ----    --------------
 *   success                 200     Estimate + Lines + Classifications created
 *   import_not_found        404     EstimateImport id not in DB
 *   wrong_import_status     422     Import status not 'previewed'
 *   wrong_project_status    422     Project status not in [active, sent_to_estimate]
 *   estimate_exists         409     project.estimate already populated
 *   no_default_region       400     Tenant has no default Region configured
 *   corrupt_payload         500     rawPayload no longer matches Cowork schema
 */
export type ApplyImportResult =
  | {
      kind: 'success';
      estimateId: string;
      classificationsCount: number;
      linesCount: number;
    }
  | { kind: 'import_not_found' }
  | { kind: 'wrong_import_status'; currentStatus: string }
  | { kind: 'wrong_project_status'; currentStatus: string }
  | { kind: 'estimate_exists'; existingEstimateId: string }
  | { kind: 'no_default_region' }
  | { kind: 'corrupt_payload'; details: ReturnType<ZodError['flatten']> };

export type ApplyImportInput = {
  importId: string;
  projectId: string;
  companyId: string;
  userId: string;
};

/**
 * Materialize a previewed EstimateImport into a real Estimate + Lines.
 *
 * Pre-conditions (all enforced inside this function):
 *   - EstimateImport exists, belongs to (companyId, projectId), status='previewed'
 *   - Project exists, status in ('active', 'sent_to_estimate')
 *   - Project has no Estimate yet (Estimate.projectId is @unique)
 *   - Tenant has a default Region
 *
 * Mutations performed inside a single transaction:
 *   - Estimate created (status='in_pricing', margins snapshotted from
 *     scenarios[recommended].markups, assumptions = rationale + flags)
 *   - For each non-skipped scope_item: upsert Classification (by service_code)
 *     and create one EstimateLine aggregating its takeoffs/materials/productivity
 *   - Project.status → 'estimate_accepted', estimateAcceptedAt = now
 *   - EstimateImport: status='applied', appliedBy/At populated, estimateId
 *     linked, previewSummary merged with the apply manifest under `.applied`
 *
 * Cowork is authoritative for prices: no local pricing engine, no
 * EstimateCostFactor rows (would double-count Cowork's own uplifts).
 */
export async function applyImport(
  prisma: PrismaClient,
  input: ApplyImportInput,
): Promise<ApplyImportResult> {
  const { importId, projectId, companyId, userId } = input;

  // 1. Preload everything OUTSIDE transaction (cheaper to fail fast).
  const importRow = await prisma.estimateImport.findFirst({
    where: { id: importId, companyId, projectId },
    select: {
      id: true,
      status: true,
      rawPayload: true,
      previewSummary: true,
    },
  });
  if (!importRow) return { kind: 'import_not_found' };
  if (importRow.status !== 'previewed') {
    return { kind: 'wrong_import_status', currentStatus: importRow.status };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: {
      id: true,
      status: true,
      estimate: { select: { id: true } },
    },
  });
  if (!project) {
    throw new Error('Project not found — should have been caught upstream');
  }

  if (project.estimate) {
    return { kind: 'estimate_exists', existingEstimateId: project.estimate.id };
  }

  if (!['active', 'sent_to_estimate'].includes(project.status)) {
    return { kind: 'wrong_project_status', currentStatus: project.status };
  }

  const region = await prisma.region.findFirst({
    where: { companyId, isDefault: true },
    select: { id: true },
  });
  if (!region) return { kind: 'no_default_region' };

  // Defensive re-validation: even though preview already passed Zod,
  // the JSONB column could have drifted (manual DB edit, schema bump).
  const parseResult = CoworkImportV1Schema.safeParse(importRow.rawPayload);
  if (!parseResult.success) {
    return { kind: 'corrupt_payload', details: parseResult.error.flatten() };
  }
  const payload = parseResult.data;

  // 2. Pick recommended scenario (Rule 7 in the preview guaranteed this).
  const recommendedCode = payload.summary.recommended_scenario_code;
  const scenario = payload.scenarios.find((s) => s.scenario_code === recommendedCode);
  if (!scenario) {
    throw new Error('Recommended scenario missing — Rule 7 should have caught');
  }

  // 3. Build assumptions text (rationale + non-blocker review flags).
  const assumptions = buildAssumptions(payload);

  // 4. Begin transaction.
  const result = await prisma.$transaction(
    async (tx) => {
      // 4a. Create Estimate with margins from scenario.
      const estimate = await tx.estimate.create({
        data: {
          companyId,
          projectId,
          regionId: region.id,
          status: 'in_pricing',
          ownerId: userId,
          shopType: 'open_shop', // Cowork doesn't emit shop type; default.
          mhRangeMode: 'avg',
          markupPercent: pctToPercent(scenario.markups.profit_pct),
          overheadPercent: pctToPercent(scenario.markups.overhead_pct),
          generalConditionsPercent: pctToPercent(scenario.markups.general_conditions_pct),
          contingencyPercent: pctToPercent(scenario.markups.contingency_pct),
          salesTaxPercent: null,
          assumptions: assumptions.length > 0 ? assumptions : null,
          totalEnvelopeSf:
            payload.estimate_meta.areas?.wall_gross_sf ??
            payload.estimate_meta.areas?.finished_sf ??
            null,
        },
        select: { id: true },
      });

      // 4b. Loop scope_items.
      const classificationIds: string[] = [];
      const lineIds: string[] = [];

      for (const scope of payload.scope_items) {
        // Skip non-cost items.
        if (scope.type === 'NOTE') continue;
        if (scope.status === 'BY_OTHERS' || scope.status === 'BY_OWNER') continue;
        if (scope.status === 'EXCLUDED') continue;

        const isAllowance = scope.status === 'ALLOWANCE';

        // 4b-i. Aggregate from JSON for this service_code.
        const takeoffs = payload.takeoff_items.filter((t) => t.service_code === scope.service_code);
        const materials = payload.materials.filter((m) => m.service_code === scope.service_code);
        const productivity = payload.labor_productivity.filter(
          (p) => p.service_code === scope.service_code,
        );

        // For allowance: quantity=1, unit='LOT', no labor.
        let quantity: number;
        let uom: string;
        if (isAllowance) {
          quantity = 1;
          uom = 'LOT';
        } else {
          quantity = takeoffs.reduce((s, t) => s + t.quantity, 0);
          uom = takeoffs[0]?.unit ?? 'EA';
        }

        // 4b-ii. Upsert Classification by externalId = service_code.
        const existingClassification = await tx.classification.findFirst({
          where: {
            projectId,
            externalId: { equals: scope.service_code, mode: 'insensitive' },
          },
          select: { id: true },
        });

        let classificationId: string;
        if (existingClassification) {
          const updated = await tx.classification.update({
            where: { id: existingClassification.id },
            data: {
              name: scope.description,
              quantity,
              scope: 'service_and_material',
              note: scope.notes ?? null,
            },
            select: { id: true },
          });
          classificationId = updated.id;
        } else {
          const created = await tx.classification.create({
            data: {
              companyId,
              projectId,
              externalId: scope.service_code,
              name: scope.description,
              type: scope.category,
              uom,
              scope: 'service_and_material',
              quantity,
              note: scope.notes ?? null,
            },
            select: { id: true },
          });
          classificationId = created.id;
        }
        classificationIds.push(classificationId);

        // 4b-iii. Build materialBreakdown JSON.
        // Aggregate waste across takeoffs of this service_code — use max for
        // conservative material overbuy. Computed once per scope_item,
        // not per material (all materials share the same service_code here).
        const maxWaste =
          takeoffs.length > 0 ? Math.max(...takeoffs.map((t) => t.waste_pct ?? 0)) : 0;

        const materialBreakdown = materials.map((m) => {
          const unitCostCents = Math.round(m.unit_cost * 100);
          const subtotalCents = Math.round((m.total ?? m.qty * m.unit_cost) * 100);
          return {
            materialId: null,
            name: m.description,
            qty: m.qty,
            uom: m.unit,
            unitCostCents,
            wastePercent: Math.round(maxWaste * 100),
            subtotalCents,
          };
        });

        const materialCostCents = isAllowance
          ? Math.round((scope.allowance_amount ?? 0) * 100)
          : materialBreakdown.reduce((s, m) => s + m.subtotalCents, 0);

        // 4b-iv. Labor (skip if allowance).
        let mhPerUnit: number | null = null;
        let laborHours: number | null = null;
        let laborRateCents: number | null = null;
        let laborCostCents: number | null = null;

        if (!isAllowance && productivity.length > 0) {
          // Sum total_mh across all productivity rows for this service_code.
          const totalMh = productivity.reduce((s, p) => s + (p.total_mh ?? 0), 0);
          // Weighted mh_per_unit against aggregated takeoff quantity.
          mhPerUnit = quantity > 0 ? totalMh / quantity : 0;
          laborHours = totalMh;

          // Pick first productivity's primary trade for rate.
          const primaryProd = productivity[0];
          const primaryTradeCode = primaryProd.crew_composition?.[0]?.trade_code;
          if (primaryTradeCode) {
            const laborRateRow = payload.labor_rates.find(
              (lr) => lr.trade_code === primaryTradeCode,
            );
            if (laborRateRow) {
              laborRateCents = Math.round(laborRateRow.billed_hr * 100);
              laborCostCents = Math.round(laborHours * laborRateRow.billed_hr * 100);
            }
          }
        }

        const subtotalCents = (materialCostCents ?? 0) + (laborCostCents ?? 0);

        // 4b-v. productivityEntryId / laborTradeId are set to null intentionally.
        // Cowork is authoritative on pricing; we snapshot productivity data
        // from the payload (mhPerUnit, laborHours, laborRateCents) without
        // linking to master ProductivityEntry / LaborRate records. A future
        // iteration could add fuzzy matching, but it's not required for the
        // snapshot-driven import flow.
        const productivityEntryId: string | null = null;
        const laborTradeId: string | null = null;

        // 4b-vi. Create EstimateLine.
        const line = await tx.estimateLine.create({
          data: {
            companyId,
            estimateId: estimate.id,
            classificationId,
            name: scope.description,
            externalId: scope.service_code,
            scope: 'service_and_material',
            uom,
            quantity,
            productivityEntryId,
            laborTradeId,
            mhPerUnit,
            laborHours,
            laborRateCents,
            laborCostCents,
            materialCostCents,
            materialBreakdown:
              materialBreakdown.length > 0 ? (materialBreakdown as unknown as object) : undefined,
            unitPriceCents: null, // Computed post-markup; UI/API recompute.
            subtotalCents,
            displayOrder: classificationIds.length * 10,
            source: isAllowance ? 'cowork-import-allowance' : 'cowork-import',
            suggestedByAi: false,
            aiConfidence: scope.ai_confidence?.score
              ? Math.round(scope.ai_confidence.score * 100)
              : 100,
            needsReview: false,
            notes: scope.notes ?? null,
          },
          select: { id: true },
        });
        lineIds.push(line.id);
      }

      // 4c. Update project status.
      await tx.project.update({
        where: { id: projectId },
        data: {
          status: 'estimate_accepted',
          estimateAcceptedAt: new Date(),
        },
      });

      // 4d. Update EstimateImport with apply manifest.
      // Merge into existing previewSummary so we keep {summary, warnings}
      // from the preview alongside the new {applied: ...} manifest.
      const isObjectLike =
        importRow.previewSummary !== null &&
        typeof importRow.previewSummary === 'object' &&
        !Array.isArray(importRow.previewSummary);

      const existingPreview: Record<string, unknown> = isObjectLike
        ? (importRow.previewSummary as Record<string, unknown>)
        : {};

      const updatedPreview = {
        ...existingPreview,
        applied: {
          appliedAt: new Date().toISOString(),
          appliedById: userId,
          estimateId: estimate.id,
          classificationIds,
          lineIds,
        },
      };

      await tx.estimateImport.update({
        where: { id: importId },
        data: {
          status: 'applied',
          appliedById: userId,
          appliedAt: new Date(),
          estimateId: estimate.id,
          previewSummary: updatedPreview as unknown as object,
        },
      });

      return {
        estimateId: estimate.id,
        classificationsCount: classificationIds.length,
        linesCount: lineIds.length,
      };
    },
    { timeout: 30_000 },
  );

  return {
    kind: 'success',
    estimateId: result.estimateId,
    classificationsCount: result.classificationsCount,
    linesCount: result.linesCount,
  };
}

/**
 * Build the assumptions text shown on proposals.
 *
 * Includes the Cowork rationale + REVIEW/INFO flags. BLOCKER flags
 * are excluded since they should have been resolved before export.
 */
function buildAssumptions(payload: CoworkImportV1): string {
  const lines: string[] = [];
  if (payload.summary.recommendation_rationale) {
    lines.push(payload.summary.recommendation_rationale);
  }

  const flags = (payload.review_flags ?? []).filter((f) => f.severity !== 'BLOCKER');
  if (flags.length > 0) {
    lines.push('');
    lines.push('REVIEW FLAGS:');
    for (const f of flags) {
      lines.push(`- [${f.severity}] ${f.target}: ${f.reason}`);
    }
  }

  return lines.join('\n').trim();
}

/**
 * Convert Cowork's decimal pct (0.10 = 10%) to Prisma's percent (10.00).
 */
function pctToPercent(decimal: number | undefined | null): number | null {
  if (decimal === undefined || decimal === null) return null;
  return Math.round(decimal * 10000) / 100;
}
