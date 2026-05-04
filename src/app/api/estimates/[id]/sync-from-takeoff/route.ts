import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import {
  priceClassification,
  priceWithProductivity,
  resolveFallbackTrade,
  sectionForDivision,
  type PricingConfig,
  type MhRangeMode,
  type ShopType,
} from '@/lib/estimate-pricing';
import { resolveClassification } from '@/lib/togal-resolver';

/**
 * POST /api/estimates/[id]/sync-from-takeoff
 *
 * Picks up Classifications added on the Takeoff side AFTER the
 * estimate was accepted and turns them into new EstimateLines.
 *
 * Only ADDS — never edits or removes existing lines. Existing
 * AI corrections, manual price overrides, etc. are preserved.
 *
 * Pricing uses the estimate's persisted settings (regionId,
 * shopType, mhRangeMode), not the company defaults — so newly
 * synced lines stay consistent with the rest of the estimate.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
        include: {
          classifications: { orderBy: { createdAt: 'asc' } },
        },
      },
      lines: { select: { classificationId: true, displayOrder: true } },
      region: true,
    },
  });
  if (!estimate) {
    return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
  }
  if (!estimate.region) {
    return NextResponse.json({ error: 'Estimate has no region configured' }, { status: 400 });
  }

  // Find classifications that don't yet have a line on this estimate.
  const usedClassificationIds = new Set(
    estimate.lines.map((l) => l.classificationId).filter((v): v is string => !!v),
  );
  const orphans = estimate.project.classifications.filter((c) => !usedClassificationIds.has(c.id));

  if (orphans.length === 0) {
    return NextResponse.json({ added: 0 });
  }

  // Reference data — same shape the pricing engine expects.
  const [productivityRows, laborRatesAll, materialsAll, divisions, trades] = await Promise.all([
    prisma.productivityEntry.findMany({ where: { companyId: ctx.companyId } }),
    prisma.laborRate.findMany({ where: { companyId: ctx.companyId } }),
    prisma.material.findMany({ where: { companyId: ctx.companyId } }),
    prisma.division.findMany({ where: { companyId: ctx.companyId } }),
    prisma.laborTrade.findMany({ where: { companyId: ctx.companyId } }),
  ]);

  const config: PricingConfig = {
    regionId: estimate.region.id,
    shopType: estimate.shopType as ShopType,
    mhRangeMode: estimate.mhRangeMode as MhRangeMode,
  };

  const tradeRefs = trades.map((t) => ({
    id: t.id,
    name: t.name,
    divisionId: t.divisionId,
  }));
  const fallbackTradeByDivisionId = new Map<string, string>();
  const sectionByDivisionId = new Map<string, string>();
  for (const d of divisions) {
    const tid = resolveFallbackTrade(d.name, tradeRefs);
    if (tid) fallbackTradeByDivisionId.set(d.id, tid);
    sectionByDivisionId.set(d.id, sectionForDivision(d.name));
  }

  const refs = {
    productivity: productivityRows.map((p) => ({
      id: p.id,
      divisionId: p.divisionId,
      scopeName: p.scopeName,
      uom: p.uom,
      crewDescription: p.crewDescription,
      assumedTradeId: p.assumedTradeId,
      mhPerUnitLow: p.mhPerUnitLow !== null ? Number(p.mhPerUnitLow) : null,
      mhPerUnitAvg: Number(p.mhPerUnitAvg),
      mhPerUnitHigh: p.mhPerUnitHigh !== null ? Number(p.mhPerUnitHigh) : null,
      matchCode: p.matchCode,
      matchKeywords: p.matchKeywords,
      notes: p.notes,
    })),
    laborRates: laborRatesAll.map((r) => ({
      id: r.id,
      tradeId: r.tradeId,
      regionId: r.regionId,
      shopType: r.shopType,
      lowCents: r.lowCents,
      avgCents: r.avgCents,
      highCents: r.highCents,
    })),
    materials: materialsAll.map((m) => ({
      id: m.id,
      divisionId: m.divisionId,
      name: m.name,
      uom: m.uom,
      lowCents: m.lowCents,
      avgCents: m.avgCents,
      highCents: m.highCents,
      wastePercent: m.wastePercent,
    })),
    fallbackTradeByDivisionId,
  };

  const resolverRefs = {
    productivities: refs.productivity.map((p) => ({
      id: p.id,
      divisionId: p.divisionId,
      uom: p.uom,
      matchCode: p.matchCode,
      scopeName: p.scopeName,
    })),
    divisions: divisions.map((d) => ({ id: d.id, name: d.name })),
  };

  // Continue numbering from where existing lines left off.
  const maxOrder = estimate.lines.reduce((m, l) => Math.max(m, l.displayOrder ?? 0), -1);

  try {
    const added = await prisma.$transaction(
      async (tx) => {
        let order = maxOrder + 1;

        for (const cls of orphans) {
          const pricingInput = {
            name: cls.name,
            externalId: cls.externalId,
            scope: cls.scope,
            uom: cls.uom,
            quantity: Number(cls.quantity),
          };

          const resolved = resolveClassification(
            {
              togalId: cls.togalId,
              togalFolder: cls.togalFolder,
              name: cls.name,
              externalId: cls.externalId,
              uom: cls.uom,
            },
            resolverRefs,
          );

          if (resolved.divisionId && cls.divisionId !== resolved.divisionId) {
            await tx.classification.update({
              where: { id: cls.id },
              data: { divisionId: resolved.divisionId },
            });
          }

          let result;
          let source: string;

          if (resolved.uomMismatch) {
            result = {
              productivityEntryId: null,
              laborTradeId: null,
              mhPerUnit: null,
              laborHours: null,
              laborRateCents: null,
              laborCostCents: null,
              materialCostCents: null,
              materialBreakdown: null,
              suggestedByAi: false,
              aiConfidence: 0,
              needsReview: true,
              notes: [resolved.reason],
            };
            source = 'manual';
          } else if (resolved.productivityEntryId) {
            result = priceWithProductivity(
              resolved.productivityEntryId,
              pricingInput,
              config,
              refs,
            );
            result.notes.unshift(resolved.reason);
            source = resolved.source;
          } else {
            result = priceClassification(pricingInput, config, refs);
            source = result.productivityEntryId ? 'ai-classified' : 'manual';
            if (resolved.divisionId && resolved.source === 'togal-folder') {
              result.notes.unshift(resolved.reason);
            }
          }

          const subtotalCents = (result.laborCostCents ?? 0) + (result.materialCostCents ?? 0);

          let groupName = 'Unclassified';
          const divIdForGroup = result.productivityEntryId
            ? refs.productivity.find((p) => p.id === result.productivityEntryId)?.divisionId
            : resolved.divisionId;
          if (divIdForGroup) {
            groupName = sectionByDivisionId.get(divIdForGroup) ?? 'Other';
          }

          await tx.estimateLine.create({
            data: {
              companyId: ctx.companyId,
              estimateId: estimate.id,
              classificationId: cls.id,
              name: cls.name,
              externalId: cls.externalId,
              scope: cls.scope,
              uom: cls.uom,
              quantity: cls.quantity,
              productivityEntryId: result.productivityEntryId,
              laborTradeId: result.laborTradeId,
              mhPerUnit: result.mhPerUnit,
              laborHours: result.laborHours,
              laborRateCents: result.laborRateCents,
              laborCostCents: result.laborCostCents,
              materialCostCents: result.materialCostCents,
              materialBreakdown: result.materialBreakdown
                ? (result.materialBreakdown as any)
                : undefined,
              subtotalCents,
              displayOrder: order++,
              groupName,
              suggestedByAi: result.suggestedByAi,
              aiConfidence: result.aiConfidence,
              needsReview: result.needsReview,
              notes: result.notes.length ? result.notes.join(' · ') : null,
              source,
            },
          });
        }

        return orphans.length;
      },
      { timeout: 30_000 },
    );

    return NextResponse.json({ added });
  } catch (err: any) {
    console.error('[estimates.sync-from-takeoff.POST]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to sync from takeoff' },
      { status: 500 },
    );
  }
}
