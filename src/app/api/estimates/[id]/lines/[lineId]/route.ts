import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import {
  resolveFallbackTrade,
  type MhRangeMode,
} from '@/lib/estimate-pricing';

const materialItemSchema = z.object({
  materialId: z.string().uuid().nullable().optional(),
  name: z.string(),
  qty: z.number().nonnegative(),
  uom: z.string(),
  unitCostCents: z.number().int().nonnegative(),
  wastePercent: z.number().int().min(0).max(100).default(5),
  subtotalCents: z.number().int().nonnegative(),
});

/**
 * Patch shape:
 *  - Apply an AI suggestion: send productivityEntryId + materialId
 *    + (optional) customMaterials. Server resolves trade + rate +
 *    material breakdown and recomputes labor/material costs from the
 *    estimate's regionId + shopType + mhRangeMode.
 *  - OR send raw labor / material values for full manual override.
 *
 * Either way, the line is marked userOverridden=true (it's no longer
 * a pure heuristic suggestion) and needsReview is cleared if the
 * resulting cost is non-zero.
 */
const patchSchema = z
  .object({
    // AI / structured update path
    productivityEntryId: z.string().uuid().nullable().optional(),
    materialId: z.string().uuid().nullable().optional(),
    customMaterials: z.array(materialItemSchema).optional(),
    aiConfidence: z.number().int().min(0).max(100).optional(),
    needsReview: z.boolean().optional(),
    suggestedByAi: z.boolean().optional(),
    notes: z.string().nullable().optional(),

    // Manual override path
    quantity: z.number().nonnegative().optional(),
    laborTradeId: z.string().uuid().nullable().optional(),
    mhPerUnit: z.number().nonnegative().optional(),
    laborRateCents: z.number().int().nonnegative().nullable().optional(),
    laborCostCents: z.number().int().nonnegative().nullable().optional(),
    materialCostCents: z.number().int().nonnegative().nullable().optional(),
  })
  .strict();

type PatchInput = z.infer<typeof patchSchema>;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'estimate', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id, lineId } = await params;

  const line = await prisma.estimateLine.findFirst({
    where: { id: lineId, estimateId: id, companyId: ctx.companyId },
    include: {
      estimate: {
        select: { regionId: true, shopType: true, mhRangeMode: true },
      },
    },
  });
  if (!line) return NextResponse.json({ error: 'Line not found' }, { status: 404 });

  let parsed: PatchInput;
  try {
    parsed = patchSchema.parse(await req.json());
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid payload';
    return NextResponse.json({ error: issue }, { status: 400 });
  }

  const updates: any = {
    userOverridden: true,
  };
  if (parsed.notes !== undefined) updates.notes = parsed.notes;
  if (parsed.aiConfidence !== undefined) updates.aiConfidence = parsed.aiConfidence;
  if (parsed.needsReview !== undefined) updates.needsReview = parsed.needsReview;
  if (parsed.suggestedByAi !== undefined) updates.suggestedByAi = parsed.suggestedByAi;
  if (parsed.quantity !== undefined) updates.quantity = parsed.quantity;

  const newQty = parsed.quantity !== undefined ? parsed.quantity : Number(line.quantity);

  // ----- Labor: AI/structured path -----
  if (parsed.productivityEntryId !== undefined) {
    if (parsed.productivityEntryId === null) {
      // Clear productivity-derived fields
      updates.productivityEntryId = null;
      updates.mhPerUnit = null;
      updates.laborHours = null;
      updates.laborCostCents = null;
    } else {
      const prod = await prisma.productivityEntry.findFirst({
        where: { id: parsed.productivityEntryId, companyId: ctx.companyId },
        include: { division: { select: { name: true } } },
      });
      if (!prod) {
        return NextResponse.json(
          { error: 'Productivity entry not found' },
          { status: 400 }
        );
      }
      const mode = line.estimate.mhRangeMode as MhRangeMode;
      const mh =
        mode === 'low'
          ? Number(prod.mhPerUnitLow ?? prod.mhPerUnitAvg)
          : mode === 'high'
            ? Number(prod.mhPerUnitHigh ?? prod.mhPerUnitAvg)
            : Number(prod.mhPerUnitAvg);

      // Resolve trade — explicit param > productivity.assumedTradeId > division fallback
      let tradeId: string | null = parsed.laborTradeId ?? prod.assumedTradeId;
      if (!tradeId) {
        const trades = await prisma.laborTrade.findMany({
          where: { companyId: ctx.companyId },
          select: { id: true, name: true, divisionId: true },
        });
        tradeId = resolveFallbackTrade(prod.division.name, trades);
      }

      let laborRateCents: number | null = null;
      if (tradeId) {
        const rate = await prisma.laborRate.findFirst({
          where: {
            companyId: ctx.companyId,
            tradeId,
            regionId: line.estimate.regionId,
            shopType: line.estimate.shopType,
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

      const laborHours = Math.round(newQty * mh * 1000) / 1000;
      const laborCostCents =
        laborRateCents !== null ? Math.round(laborHours * laborRateCents) : null;

      updates.productivityEntryId = prod.id;
      updates.laborTradeId = tradeId;
      updates.mhPerUnit = mh;
      updates.laborHours = laborHours;
      updates.laborRateCents = laborRateCents;
      updates.laborCostCents = laborCostCents;
    }
  }

  // ----- Manual labor overrides (after structured path so they win) -----
  if (parsed.laborTradeId !== undefined) updates.laborTradeId = parsed.laborTradeId;
  if (parsed.mhPerUnit !== undefined) {
    updates.mhPerUnit = parsed.mhPerUnit;
    updates.laborHours = Math.round(newQty * parsed.mhPerUnit * 1000) / 1000;
  }
  if (parsed.laborRateCents !== undefined) updates.laborRateCents = parsed.laborRateCents;
  if (parsed.laborCostCents !== undefined) updates.laborCostCents = parsed.laborCostCents;

  // If labor pieces changed but no explicit cost was sent, recompute it.
  if (
    (parsed.mhPerUnit !== undefined ||
      parsed.laborRateCents !== undefined ||
      parsed.quantity !== undefined) &&
    parsed.laborCostCents === undefined
  ) {
    const mh = updates.mhPerUnit ?? Number(line.mhPerUnit ?? 0);
    const rate = updates.laborRateCents ?? line.laborRateCents ?? 0;
    if (mh && rate) {
      const hours = Math.round(newQty * Number(mh) * 1000) / 1000;
      updates.laborHours = hours;
      updates.laborCostCents = Math.round(hours * Number(rate));
    }
  }

  // ----- Material breakdown -----
  let breakdown: z.infer<typeof materialItemSchema>[] | null = null;

  if (parsed.materialId !== undefined) {
    if (parsed.materialId === null) {
      breakdown = [];
    } else {
      const mat = await prisma.material.findFirst({
        where: { id: parsed.materialId, companyId: ctx.companyId },
      });
      if (!mat) {
        return NextResponse.json({ error: 'Material not found' }, { status: 400 });
      }
      const mode = line.estimate.mhRangeMode as MhRangeMode;
      const unitCents =
        mode === 'low'
          ? mat.lowCents ?? mat.avgCents
          : mode === 'high'
            ? mat.highCents ?? mat.avgCents
            : mat.avgCents;
      const wastedQty =
        Math.round(newQty * (1 + mat.wastePercent / 100) * 10000) / 10000;
      const subtotal = Math.round(wastedQty * unitCents);
      breakdown = [
        {
          materialId: mat.id,
          name: mat.name,
          qty: wastedQty,
          uom: mat.uom,
          unitCostCents: unitCents,
          wastePercent: mat.wastePercent,
          subtotalCents: subtotal,
        },
      ];
    }
  }

  if (parsed.customMaterials && parsed.customMaterials.length > 0) {
    breakdown = [...(breakdown ?? []), ...parsed.customMaterials];
  }

  if (breakdown !== null) {
    updates.materialBreakdown = breakdown.length > 0 ? (breakdown as any) : undefined;
    updates.materialCostCents =
      breakdown.length > 0
        ? breakdown.reduce((s, m) => s + m.subtotalCents, 0)
        : null;
  }

  // Manual material cost overrides anything we just computed
  if (parsed.materialCostCents !== undefined) {
    updates.materialCostCents = parsed.materialCostCents;
  }

  // Subtotal = labor + material (use whatever final values we just set)
  const finalLabor = updates.laborCostCents ?? line.laborCostCents ?? 0;
  const finalMaterial = updates.materialCostCents ?? line.materialCostCents ?? 0;
  updates.subtotalCents = (finalLabor ?? 0) + (finalMaterial ?? 0);

  // Clear needsReview when the line now has a real cost (unless caller pinned it)
  if (parsed.needsReview === undefined && updates.subtotalCents > 0) {
    updates.needsReview = false;
  }

  try {
    const updated = await prisma.estimateLine.update({
      where: { id: lineId },
      data: updates,
      include: {
        productivityEntry: { select: { id: true, scopeName: true } },
        laborTrade: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error('[estimates.lines.PATCH]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to update line' },
      { status: 500 }
    );
  }
}
