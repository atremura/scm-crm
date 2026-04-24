import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { suggestForLine } from '@/lib/estimate-ai-suggester';

/**
 * POST /api/estimates/[id]/lines/[lineId]/suggest
 *
 * Asks Claude to (re)suggest the productivity + material for a single
 * estimate line. Does NOT mutate the line — it returns the suggestion
 * for the user to review and apply via PATCH.
 */
export async function POST(
  _req: NextRequest,
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
        select: {
          id: true,
          regionId: true,
          shopType: true,
          mhRangeMode: true,
          project: {
            select: { name: true, address: true, workType: true },
          },
        },
      },
    },
  });
  if (!line) {
    return NextResponse.json({ error: 'Line not found' }, { status: 404 });
  }

  const [productivity, materials, divisions] = await Promise.all([
    prisma.productivityEntry.findMany({
      where: { companyId: ctx.companyId },
      include: { division: { select: { name: true } } },
    }),
    prisma.material.findMany({
      where: { companyId: ctx.companyId },
      include: { division: { select: { name: true } } },
    }),
    prisma.division.findMany({ where: { companyId: ctx.companyId } }),
  ]);

  // Trim catalog to keep the prompt manageable. With 126 productivity
  // and 116 materials we send everything (~30k tokens). Once the
  // catalog grows past ~500 rows we'll need to pre-filter by division
  // before calling Claude.
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

  let result;
  try {
    result = await suggestForLine({
      classification: {
        name: line.name,
        scope: line.scope,
        uom: line.uom,
        quantity: Number(line.quantity),
        externalId: line.externalId,
      },
      project: {
        name: line.estimate.project.name,
        address: line.estimate.project.address,
        workType: line.estimate.project.workType,
      },
      productivityOptions,
      materialOptions,
    });
  } catch (err: any) {
    console.error('[estimates.lines.suggest.POST] Claude error', err?.message ?? err);
    if (err?.status === 401) {
      return NextResponse.json(
        { error: 'Anthropic API key invalid' },
        { status: 500 }
      );
    }
    if (err?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limited by Claude — try again in a moment' },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: err?.message ?? 'AI suggestion failed' },
      { status: 500 }
    );
  }

  // Hydrate the picks with the catalog details so the UI can render
  // labor/material costs side-by-side with the existing line values.
  const pickedProductivity = result.suggestion.productivityId
    ? productivity.find((p) => p.id === result.suggestion.productivityId)
    : null;
  const pickedMaterial = result.suggestion.materialId
    ? materials.find((m) => m.id === result.suggestion.materialId)
    : null;

  return NextResponse.json({
    suggestion: result.suggestion,
    pickedProductivity: pickedProductivity
      ? {
          id: pickedProductivity.id,
          scopeName: pickedProductivity.scopeName,
          uom: pickedProductivity.uom,
          divisionName: pickedProductivity.division.name,
          assumedTradeId: pickedProductivity.assumedTradeId,
          mhPerUnitLow: pickedProductivity.mhPerUnitLow,
          mhPerUnitAvg: pickedProductivity.mhPerUnitAvg,
          mhPerUnitHigh: pickedProductivity.mhPerUnitHigh,
        }
      : null,
    pickedMaterial: pickedMaterial
      ? {
          id: pickedMaterial.id,
          name: pickedMaterial.name,
          uom: pickedMaterial.uom,
          avgCents: pickedMaterial.avgCents,
          wastePercent: pickedMaterial.wastePercent,
        }
      : null,
    cost: {
      cents: result.costCents,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      cacheReadTokens: result.usage.cache_read_input_tokens ?? 0,
    },
  });
}
