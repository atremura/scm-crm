import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import {
  priceClassification,
  rollupTotals,
  resolveFallbackTrade,
  type PricingConfig,
  type MhRangeMode,
  type ShopType,
} from '@/lib/estimate-pricing';

/**
 * POST /api/projects/[id]/accept-estimate
 *
 * The receiver side of the Takeoff → Estimate handoff. When the
 * project is sent_to_estimate and the current user is the assigned
 * receiver (or an Admin), this creates the Estimate record, runs
 * auto-pricing across every Classification, and moves the project
 * to estimate_accepted.
 *
 * Pricing config is seeded from SystemSetting defaults:
 *   - region = the company's default Region (isDefault=true), else MA
 *   - shop_type = default_shop_type         (fallback 'open_shop')
 *   - mh_range_mode = default_mh_range_mode (fallback 'avg')
 *   - markup_percent = default_markup_percent (fallback 20)
 *   - overhead_percent = default_overhead_percent (fallback 10)
 *
 * Any cost factor with autoApply=true and a matching regionId (or
 * no region at all — global factor) is pre-selected on the estimate.
 *
 * All of this is editable from the proposal UI afterwards.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'estimate', 'create'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, companyId: ctx.companyId },
    include: {
      client: { select: { companyName: true } },
      classifications: { orderBy: { createdAt: 'asc' } },
      estimate: { select: { id: true } },
    },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Permission check on the handoff
  if (project.estimate) {
    return NextResponse.json(
      {
        error: 'This project already has an estimate',
        estimateId: project.estimate.id,
      },
      { status: 409 }
    );
  }
  if (project.status !== 'sent_to_estimate') {
    return NextResponse.json(
      { error: `Project must be sent_to_estimate — currently ${project.status}` },
      { status: 400 }
    );
  }
  const isReceiver = project.estimateReceiverId === ctx.userId;
  const isAdmin = ctx.role === 'Admin';
  if (!isReceiver && !isAdmin) {
    return NextResponse.json(
      { error: 'Only the assigned receiver or an Admin can accept this handoff' },
      { status: 403 }
    );
  }
  if (project.classifications.length === 0) {
    return NextResponse.json(
      { error: 'Project has no classifications to price' },
      { status: 400 }
    );
  }

  // --- Load defaults + reference data ---
  const [
    settingsRows,
    region,
    productivityRows,
    laborRatesAll,
    materialsAll,
    autoFactors,
    divisions,
    trades,
  ] = await Promise.all([
    prisma.systemSetting.findMany({
      where: {
        companyId: ctx.companyId,
        key: {
          in: [
            'default_shop_type',
            'default_mh_range_mode',
            'default_markup_percent',
            'default_overhead_percent',
          ],
        },
      },
    }),
    prisma.region.findFirst({
      where: { companyId: ctx.companyId, isDefault: true },
    }),
    prisma.productivityEntry.findMany({ where: { companyId: ctx.companyId } }),
    prisma.laborRate.findMany({ where: { companyId: ctx.companyId } }),
    prisma.material.findMany({ where: { companyId: ctx.companyId } }),
    prisma.costFactor.findMany({
      where: { companyId: ctx.companyId, autoApply: true, isActive: true },
    }),
    prisma.division.findMany({ where: { companyId: ctx.companyId } }),
    prisma.laborTrade.findMany({ where: { companyId: ctx.companyId } }),
  ]);

  if (!region) {
    return NextResponse.json(
      {
        error:
          'No default region configured for this company — seed the productivity database first.',
      },
      { status: 400 }
    );
  }

  const settings: Record<string, string> = {};
  for (const row of settingsRows) settings[row.key] = row.value;

  const shopType = (settings.default_shop_type as ShopType) ?? 'open_shop';
  const mhRangeMode = (settings.default_mh_range_mode as MhRangeMode) ?? 'avg';
  const markupPercent = parseFloat(settings.default_markup_percent ?? '20');
  const overheadPercent = parseFloat(settings.default_overhead_percent ?? '10');

  const config: PricingConfig = {
    regionId: region.id,
    shopType,
    mhRangeMode,
  };

  // Build a Division.id → fallback LaborTrade.id map so productivity
  // rows that didn't import a trade still get a sensible default.
  const tradeRefs = trades.map((t) => ({
    id: t.id,
    name: t.name,
    divisionId: t.divisionId,
  }));
  const fallbackTradeByDivisionId = new Map<string, string>();
  for (const d of divisions) {
    const tid = resolveFallbackTrade(d.name, tradeRefs);
    if (tid) fallbackTradeByDivisionId.set(d.id, tid);
  }

  // Massage reference rows into the plain shape the pricing engine expects
  // (Prisma Decimals → numbers, null-safety).
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

  // Auto-apply factors: keep ones with no region (global) OR region match
  const applicableFactors = autoFactors.filter(
    (f) => f.regionId === null || f.regionId === region.id
  );

  // --- Price + persist in one transaction ---
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const estimate = await tx.estimate.create({
          data: {
            companyId: ctx.companyId,
            projectId: project.id,
            status: 'in_pricing',
            ownerId: ctx.userId,
            receivedFromId: project.sentToEstimateById,
            receivedAt: new Date(),
            acceptedAt: new Date(),
            regionId: region.id,
            shopType,
            mhRangeMode,
            markupPercent,
            overheadPercent,
            clientName: project.client?.companyName ?? null,
          },
        });

        // Price + insert lines one by one (need per-line pricing result)
        let order = 0;
        for (const cls of project.classifications) {
          const result = priceClassification(
            {
              name: cls.name,
              externalId: cls.externalId,
              scope: cls.scope,
              uom: cls.uom,
              quantity: Number(cls.quantity),
            },
            config,
            refs
          );

          const subtotalCents =
            (result.laborCostCents ?? 0) + (result.materialCostCents ?? 0);

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
              suggestedByAi: result.suggestedByAi,
              aiConfidence: result.aiConfidence,
              needsReview: result.needsReview,
              notes: result.notes.length ? result.notes.join(' · ') : null,
            },
          });
        }

        // Snapshot auto-applied cost factors onto the estimate
        for (const f of applicableFactors) {
          await tx.estimateCostFactor.create({
            data: {
              estimateId: estimate.id,
              costFactorId: f.id,
              name: f.name,
              impactPercent: f.impactPercent,
              appliesTo: f.appliesTo,
              autoApplied: true,
            },
          });
        }

        // Move the project state forward
        await tx.project.update({
          where: { id: project.id },
          data: {
            status: 'estimate_accepted',
            estimateAcceptedAt: new Date(),
          },
        });

        return estimate.id;
      },
      { timeout: 30_000 }
    );

    return NextResponse.json({ estimateId: result }, { status: 201 });
  } catch (err: any) {
    console.error('[projects.accept-estimate.POST]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to accept estimate' },
      { status: 500 }
    );
  }
}
