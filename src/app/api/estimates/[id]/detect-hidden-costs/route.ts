import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import {
  runRulesEngine,
  type RuleRef,
  type DerivativeFormula,
} from '@/lib/derivative-rules-engine';
import { detectHiddenCosts } from '@/lib/ai-hidden-costs';

/**
 * POST /api/estimates/[id]/detect-hidden-costs
 *
 * IA-2 — Hidden Cost Detector orchestrator.
 *
 * Pipeline (hybrid deterministic + AI):
 *
 *   1. Load estimate + lines + active DerivativeCostRules + materials + divisions.
 *   2. Run deterministic rules engine — emits a list of derivative line proposals.
 *   3. Identify lines whose productivity has NO rule (uncoveredProductivityIds).
 *   4. If any uncovered + estimate has direct cost, call IA-2 to propose:
 *        a. derivative lines for THIS estimate (we insert them).
 *        b. NEW rules for the company catalog (we queue as Suggestion).
 *   5. Persist:
 *        - All proposals → EstimateLine rows with source='ai-derivative',
 *          parentLineId set, derivedFromRuleId where applicable.
 *        - Rule proposals → Suggestion rows (status='pending') for Andre.
 *        - Estimate.aiHiddenCostsRunAt + aiHiddenCostsResult JSON.
 *
 * Re-runnable: existing 'ai-derivative' lines from previous runs are
 * deleted at the start, so the result reflects current rules + AI.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'estimate', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const estimate = await prisma.estimate.findFirst({
    where: { id, companyId: ctx.companyId },
    include: {
      project: {
        select: { durationWeeks: true, stories: true, siteConditions: true },
      },
      region: { select: { name: true } },
      lines: {
        where: { source: { not: 'ai-derivative' } }, // only "real" lines feed the engine
        include: {
          productivityEntry: {
            select: { id: true, matchCode: true, divisionId: true, scopeName: true },
          },
        },
      },
    },
  });
  if (!estimate) {
    return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
  }

  const [rulesRows, materialsRows, divisionsRows] = await Promise.all([
    prisma.derivativeCostRule.findMany({
      where: { companyId: ctx.companyId, isActive: true },
    }),
    prisma.material.findMany({
      where: { companyId: ctx.companyId },
      include: { division: { select: { name: true } } },
    }),
    prisma.division.findMany({ where: { companyId: ctx.companyId } }),
  ]);

  // Convert Prisma JSONB → typed formula. Defensive: skip rules with malformed
  // formulas instead of throwing — bad data shouldn't tank the whole run.
  const rules: RuleRef[] = [];
  for (const r of rulesRows) {
    const f = r.formula as unknown as DerivativeFormula;
    if (!f || !('kind' in f)) continue;
    rules.push({
      id: r.id,
      triggerProductivityMatchCode: r.triggerProductivityMatchCode,
      triggerDivisionId: r.triggerDivisionId,
      name: r.name,
      costType: r.costType as RuleRef['costType'],
      formula: f,
      materialIdRef: r.materialIdRef,
      uomIn: r.uomIn,
      uomOut: r.uomOut,
      isActive: r.isActive,
    });
  }

  const lines = estimate.lines.map((l) => ({
    id: l.id,
    classificationId: l.classificationId,
    name: l.name,
    externalId: l.externalId,
    scope: l.scope,
    uom: l.uom,
    quantity: Number(l.quantity),
    productivityEntryId: l.productivityEntryId,
    productivityMatchCode: l.productivityEntry?.matchCode ?? null,
    productivityDivisionId: l.productivityEntry?.divisionId ?? null,
    laborCostCents: l.laborCostCents,
    materialCostCents: l.materialCostCents,
    subtotalCents: l.subtotalCents,
    source: l.source,
  }));

  const materialsForEngine = materialsRows.map((m) => ({
    id: m.id,
    name: m.name,
    uom: m.uom,
    avgCents: m.avgCents,
    wastePercent: m.wastePercent,
  }));

  // ---- Step 1: deterministic rules engine ----
  const engineResult = runRulesEngine({
    rules,
    materials: materialsForEngine,
    lines,
    durationWeeks: estimate.project.durationWeeks ?? null,
  });

  // ---- Step 2: AI on uncovered productivities ----
  let aiResult: Awaited<ReturnType<typeof detectHiddenCosts>> | null = null;
  let aiCostCents = 0;
  let aiTokens = { input: 0, output: 0, cacheRead: 0 };

  const uncoveredLineIds = new Set<string>();
  for (const l of lines) {
    if (l.productivityEntryId && engineResult.uncoveredProductivityIds.includes(l.productivityEntryId)) {
      uncoveredLineIds.add(l.id);
    }
  }

  if (uncoveredLineIds.size > 0 || rules.length === 0) {
    const directCostCents = lines.reduce(
      (s, l) => s + (l.laborCostCents ?? 0) + (l.materialCostCents ?? 0),
      0
    );

    const divisionByIdMap = new Map(divisionsRows.map((d) => [d.id, d]));

    const uncoveredLinesForAi = lines
      .filter((l) => uncoveredLineIds.has(l.id))
      .map((l) => ({
        id: l.id,
        name: l.name,
        externalId: l.externalId,
        uom: l.uom,
        quantity: l.quantity,
        productivityMatchCode: l.productivityMatchCode,
        productivityDivision: l.productivityDivisionId
          ? divisionByIdMap.get(l.productivityDivisionId)?.name ?? null
          : null,
        productivityScopeName:
          estimate.lines.find((el) => el.id === l.id)?.productivityEntry?.scopeName ?? null,
        laborCostCents: l.laborCostCents,
        materialCostCents: l.materialCostCents,
      }));

    try {
      aiResult = await detectHiddenCosts({
        estimate: {
          id: estimate.id,
          region: estimate.region.name,
          durationWeeks: estimate.project.durationWeeks ?? null,
          stories: estimate.project.stories ?? null,
          siteConditions: (estimate.project.siteConditions as any) ?? null,
          directCostCents,
        },
        uncoveredLines: uncoveredLinesForAi,
        existingRules: rules.map((r) => ({
          name: r.name,
          triggerProductivityMatchCode: r.triggerProductivityMatchCode,
          triggerDivisionName: r.triggerDivisionId
            ? divisionByIdMap.get(r.triggerDivisionId)?.name ?? null
            : null,
          formulaKind: r.formula.kind,
        })),
        materials: materialsRows.map((m) => ({
          id: m.id,
          name: m.name,
          uom: m.uom,
          avgCents: m.avgCents,
          division: m.division?.name ?? null,
        })),
        divisions: divisionsRows.map((d) => ({ id: d.id, name: d.name })),
      });
      aiCostCents = aiResult.costCents;
      aiTokens = {
        input: aiResult.usage.input_tokens,
        output: aiResult.usage.output_tokens,
        cacheRead: aiResult.usage.cache_read_input_tokens ?? 0,
      };
    } catch (err: any) {
      console.error('[estimates.detect-hidden-costs.AI]', err);
      // Don't fail the whole run — the deterministic engine still
      // produced proposals. Surface the AI error in the response.
      return NextResponse.json(
        {
          error: `AI step failed: ${err?.message ?? 'unknown'}. Deterministic engine still produced ${engineResult.proposals.length} proposals — re-run after fixing the AI issue.`,
        },
        { status: 500 }
      );
    }
  }

  // ---- Step 3: persist ----
  await prisma.$transaction(
    async (tx) => {
      // Wipe previous AI-derivative lines so re-runs are idempotent
      await tx.estimateLine.deleteMany({
        where: { estimateId: estimate.id, source: 'ai-derivative' },
      });

      // Insert engine proposals
      let order = 9000; // AI-derivative lines render after the explicit ones
      for (const p of engineResult.proposals) {
        await tx.estimateLine.create({
          data: {
            companyId: ctx.companyId,
            estimateId: estimate.id,
            classificationId: null,
            name: p.name,
            externalId: null,
            scope: p.scope,
            uom: p.uom,
            quantity: p.quantity,
            productivityEntryId: null,
            laborTradeId: null,
            mhPerUnit: null,
            laborHours: null,
            laborRateCents: null,
            laborCostCents: p.laborCostCents,
            materialCostCents: p.materialCostCents,
            materialBreakdown: p.materialBreakdown
              ? (p.materialBreakdown as any)
              : undefined,
            subtotalCents: p.subtotalCents,
            displayOrder: order++,
            groupName: 'Hidden costs (auto)',
            suggestedByAi: false,
            aiConfidence: 100,
            needsReview: false,
            notes: `Rule "${p.ruleName}" · ${p.reason}`,
            source: 'ai-derivative',
            parentLineId: p.parentLineId,
            derivedFromRuleId: p.ruleId,
          },
        });
      }

      // Insert AI-proposed derivative lines (no derivedFromRuleId yet)
      if (aiResult) {
        for (const dl of aiResult.result.derivativeLines) {
          await tx.estimateLine.create({
            data: {
              companyId: ctx.companyId,
              estimateId: estimate.id,
              classificationId: null,
              name: dl.name,
              externalId: null,
              scope: dl.costType === 'material' ? 'service_and_material' : 'service',
              uom: dl.uom,
              quantity: dl.quantity,
              productivityEntryId: null,
              laborTradeId: null,
              mhPerUnit: null,
              laborHours: null,
              laborRateCents: null,
              laborCostCents:
                dl.costType === 'labor' || dl.costType === 'cleanup'
                  ? dl.subtotalCents
                  : null,
              materialCostCents: dl.costType === 'material' ? dl.subtotalCents : null,
              materialBreakdown: undefined,
              subtotalCents: dl.subtotalCents,
              displayOrder: order++,
              groupName: 'Hidden costs (AI)',
              suggestedByAi: true,
              aiConfidence: 70,
              needsReview: true,
              notes: `IA-2 proposed · ${dl.reason}`,
              source: 'ai-derivative',
              parentLineId: dl.parentLineId,
              derivedFromRuleId: null,
            },
          });
        }

        // Queue rule proposals as Suggestion rows
        for (const rp of aiResult.result.newRules) {
          await tx.suggestion.create({
            data: {
              companyId: ctx.companyId,
              type: 'derivative_rule',
              payload: rp as any,
              justification: rp.notes,
              confidence: 75,
              sourceEstimateId: estimate.id,
              modelUsed: 'claude-opus-4-7',
              costCents: aiResult.costCents,
              status: 'pending',
            },
          });
        }
      }

      // Mark estimate
      await tx.estimate.update({
        where: { id: estimate.id },
        data: {
          aiHiddenCostsRunAt: new Date(),
          aiHiddenCostsResult: {
            engineProposals: engineResult.proposals.length,
            uncoveredProductivityIds: engineResult.uncoveredProductivityIds,
            aiDerivativeLines: aiResult?.result.derivativeLines.length ?? 0,
            aiNewRules: aiResult?.result.newRules.length ?? 0,
            aiReasoning: aiResult?.result.reasoning ?? null,
            aiCostCents,
            ranAt: new Date().toISOString(),
          } as any,
        },
      });
    },
    { timeout: 30_000 }
  );

  return NextResponse.json({
    engineProposalsAdded: engineResult.proposals.length,
    aiDerivativeLinesAdded: aiResult?.result.derivativeLines.length ?? 0,
    aiNewRulesQueued: aiResult?.result.newRules.length ?? 0,
    uncoveredProductivities: engineResult.uncoveredProductivityIds.length,
    costCents: aiCostCents,
    tokens: aiTokens,
  });
}
