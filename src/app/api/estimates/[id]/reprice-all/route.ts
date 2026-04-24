import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { suggestForLine } from '@/lib/estimate-ai-suggester';
import {
  resolveFallbackTrade,
  sectionForDivision,
  type MhRangeMode,
} from '@/lib/estimate-pricing';

/**
 * POST /api/estimates/[id]/reprice-all
 *
 * Asks Claude to re-price every line that's still flagged needsReview
 * (and hasn't been manually overridden), then applies the suggestions.
 * Runs N requests in parallel — keep N small (3) so we don't blow
 * through the API rate limit on a 30-line estimate.
 *
 * Returns counts + total Claude cost so the UI can show how much it
 * spent.
 */

const PARALLEL = 3;

type LineResult = {
  lineId: string;
  ok: boolean;
  applied?: boolean;
  costCents?: number;
  error?: string;
  reason?: string;
};

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
      project: { select: { name: true, address: true, workType: true } },
    },
  });
  if (!estimate) {
    return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
  }

  // Lines to process: needsReview but not user-overridden. Skip lines
  // where the user already locked in their answer.
  const lines = await prisma.estimateLine.findMany({
    where: {
      estimateId: id,
      companyId: ctx.companyId,
      needsReview: true,
      userOverridden: false,
    },
    orderBy: { displayOrder: 'asc' },
  });

  if (lines.length === 0) {
    return NextResponse.json({
      processed: 0,
      applied: 0,
      failed: 0,
      totalCostCents: 0,
      results: [],
    });
  }

  // Pre-load reference catalogs once for the batch.
  const [productivity, materials, divisions, trades] = await Promise.all([
    prisma.productivityEntry.findMany({
      where: { companyId: ctx.companyId },
      include: { division: { select: { name: true } } },
    }),
    prisma.material.findMany({
      where: { companyId: ctx.companyId },
      include: { division: { select: { name: true } } },
    }),
    prisma.division.findMany({ where: { companyId: ctx.companyId } }),
    prisma.laborTrade.findMany({
      where: { companyId: ctx.companyId },
      select: { id: true, name: true, divisionId: true },
    }),
  ]);

  const productivityOptions = productivity.map((p) => ({
    id: p.id,
    division: p.division.name,
    scopeName: p.scopeName,
    uom: p.uom,
    mhPerUnitAvg: Number(p.mhPerUnitAvg),
  }));
  const materialOptions = materials.map((m) => ({
    id: m.id,
    division: m.division?.name ?? null,
    name: m.name,
    uom: m.uom,
    avgCents: m.avgCents,
    wastePercent: m.wastePercent,
  }));

  const sectionByDivisionId = new Map<string, string>();
  for (const d of divisions) {
    sectionByDivisionId.set(d.id, sectionForDivision(d.name));
  }

  const mode = estimate.mhRangeMode as MhRangeMode;
  // Capture concrete values for the closure so TS doesn't lose narrowing.
  const ctxCompanyId = ctx.companyId;
  const ctxUserId = ctx.userId;
  const estRegionId = estimate.regionId;
  const estShopType = estimate.shopType;
  const estProject = estimate.project;

  // Promise pool — process up to PARALLEL lines at a time.
  const results: LineResult[] = [];
  let totalCostCents = 0;

  async function processLine(line: (typeof lines)[number]): Promise<void> {
    try {
      const aiResult = await suggestForLine({
        classification: {
          name: line.name,
          scope: line.scope,
          uom: line.uom,
          quantity: Number(line.quantity),
          externalId: line.externalId,
        },
        project: {
          name: estProject.name,
          address: estProject.address,
          workType: estProject.workType,
        },
        productivityOptions,
        materialOptions,
      });

      totalCostCents += aiResult.costCents;
      const sug = aiResult.suggestion;

      // Apply the suggestion — same logic as the per-line PATCH.
      // Resolve productivity → trade → rate → labor cost.
      // Resolve material → unit cost + waste → material cost.
      const updateData: any = {
        suggestedByAi: true,
        aiConfidence: sug.confidence,
        needsReview: sug.needsHumanReview,
        notes: [sug.productivityReason, sug.materialReason]
          .filter(Boolean)
          .join(' · '),
      };

      // Labor
      if (sug.productivityId) {
        const prod = productivity.find((p) => p.id === sug.productivityId);
        if (prod) {
          const mh =
            mode === 'low'
              ? Number(prod.mhPerUnitLow ?? prod.mhPerUnitAvg)
              : mode === 'high'
                ? Number(prod.mhPerUnitHigh ?? prod.mhPerUnitAvg)
                : Number(prod.mhPerUnitAvg);

          let tradeId = prod.assumedTradeId;
          if (!tradeId) tradeId = resolveFallbackTrade(prod.division.name, trades);

          let laborRateCents: number | null = null;
          if (tradeId) {
            const rate = await prisma.laborRate.findFirst({
              where: {
                companyId: ctxCompanyId,
                tradeId,
                regionId: estRegionId,
                shopType: estShopType,
              },
            });
            if (rate) {
              laborRateCents =
                mode === 'low'
                  ? rate.lowCents ?? rate.avgCents
                  : mode === 'high'
                    ? rate.highCents ?? rate.avgCents
                    : rate.avgCents;
            }
          }

          const qty = Number(line.quantity);
          const laborHours = Math.round(qty * mh * 1000) / 1000;
          const laborCostCents =
            laborRateCents !== null ? Math.round(laborHours * laborRateCents) : null;

          updateData.productivityEntryId = prod.id;
          updateData.laborTradeId = tradeId;
          updateData.mhPerUnit = mh;
          updateData.laborHours = laborHours;
          updateData.laborRateCents = laborRateCents;
          updateData.laborCostCents = laborCostCents;
          updateData.groupName = sectionForDivision(prod.division.name);
        }
      }

      // Material — catalog pick
      let breakdown: any[] = [];
      let materialCostCents: number | null = null;
      if (sug.materialId) {
        const mat = materials.find((m) => m.id === sug.materialId);
        if (mat) {
          const unitCents =
            mode === 'low'
              ? mat.lowCents ?? mat.avgCents
              : mode === 'high'
                ? mat.highCents ?? mat.avgCents
                : mat.avgCents;
          const qty = Number(line.quantity);
          const wastedQty =
            Math.round(qty * (1 + mat.wastePercent / 100) * 10000) / 10000;
          const subtotal = Math.round(wastedQty * unitCents);
          breakdown.push({
            materialId: mat.id,
            name: mat.name,
            qty: wastedQty,
            uom: mat.uom,
            unitCostCents: unitCents,
            wastePercent: mat.wastePercent,
            subtotalCents: subtotal,
          });
          materialCostCents = subtotal;
        }
      }
      // Custom materials Claude proposed
      if (sug.customMaterials.length > 0) {
        for (const c of sug.customMaterials) {
          const subtotal = Math.round(c.qty * c.estimatedUnitCostCents);
          breakdown.push({
            materialId: null,
            name: c.name,
            qty: c.qty,
            uom: c.uom,
            unitCostCents: c.estimatedUnitCostCents,
            wastePercent: c.wastePercent,
            subtotalCents: subtotal,
          });
          materialCostCents = (materialCostCents ?? 0) + subtotal;
        }
      }
      if (breakdown.length > 0) {
        updateData.materialBreakdown = breakdown;
        updateData.materialCostCents = materialCostCents;
      }

      const subtotalCents =
        (updateData.laborCostCents ?? line.laborCostCents ?? 0) +
        (updateData.materialCostCents ?? line.materialCostCents ?? 0);
      updateData.subtotalCents = subtotalCents;

      await prisma.estimateLine.update({
        where: { id: line.id },
        data: updateData,
      });

      results.push({
        lineId: line.id,
        ok: true,
        applied: true,
        costCents: aiResult.costCents,
        reason: sug.productivityReason,
      });
    } catch (err: any) {
      results.push({
        lineId: line.id,
        ok: false,
        error: err?.message ?? 'unknown',
      });
    }
  }

  // Run in chunks of PARALLEL
  for (let i = 0; i < lines.length; i += PARALLEL) {
    const chunk = lines.slice(i, i + PARALLEL);
    await Promise.all(chunk.map(processLine));
  }

  const applied = results.filter((r) => r.applied).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    processed: lines.length,
    applied,
    failed,
    totalCostCents,
    results,
  });
}
