import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { analyzeProjectContext } from '@/lib/ai-project-context';
import { toContextHintsInput } from '@/lib/project-context-hints';

/**
 * POST /api/estimates/[id]/run-project-context
 *
 * IA-1 — Project Context Analyzer.
 *
 * Reads the project metadata + takeoff classification summary, sends to
 * Claude, persists the structured output back onto Project.contextHints
 * (JSONB blob holding stories, durationWeeks, siteConditions,
 * requiredEquipment, winterRisk, permitChecklist) and onto the Estimate
 * (assumptions joined into the existing Notes & Assumptions text).
 *
 * Re-runnable any time — overwrites the previous values.
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
          classifications: {
            include: { division: { select: { name: true } } },
          },
        },
      },
      region: { select: { name: true, stateCode: true } },
    },
  });
  if (!estimate) {
    return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
  }

  // --- Build the takeoff summary ---
  const cls = estimate.project.classifications;

  // Group by division name (resolved if divisionId set; "Unclassified" otherwise).
  const byDivisionMap = new Map<
    string,
    { division: string; lineCount: number; totalQty: number; uom: string }
  >();
  for (const c of cls) {
    const divName = c.division?.name ?? 'Unclassified';
    // Bucket UOM separately when a single division has mixed units — pick
    // the dominant UOM by total qty for the IA-1 summary.
    const key = `${divName}|${c.uom}`;
    const existing = byDivisionMap.get(key);
    if (existing) {
      existing.lineCount += 1;
      existing.totalQty += Number(c.quantity);
    } else {
      byDivisionMap.set(key, {
        division: divName,
        lineCount: 1,
        totalQty: Number(c.quantity),
        uom: c.uom,
      });
    }
  }

  // Top 10 lines by quantity — gives the IA a feel for what's big.
  const notableLines = [...cls]
    .sort((a, b) => Number(b.quantity) - Number(a.quantity))
    .slice(0, 10)
    .map((c) => ({ name: c.name, uom: c.uom, quantity: Number(c.quantity) }));

  const totalEnvelopeSf = estimate.totalEnvelopeSf ? Number(estimate.totalEnvelopeSf) : null;

  // --- Run the AI ---
  let result;
  try {
    result = await analyzeProjectContext({
      project: {
        name: estimate.project.name,
        address: estimate.project.address,
        workType: estimate.project.workType,
        notes: estimate.project.notes,
      },
      drawingsText: null, // PDF text extraction not wired yet — IA degrades gracefully
      takeoffSummary: {
        totalEnvelopeSf,
        totalLines: cls.length,
        byDivision: Array.from(byDivisionMap.values()),
        notableLines,
      },
      region: {
        name: estimate.region.name,
        stateCode: estimate.region.stateCode,
      },
    });
  } catch (err: any) {
    console.error('[estimates.run-project-context.POST]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Project context analysis failed' },
      { status: 500 },
    );
  }

  const { context, costCents, usage } = result;

  // --- Persist ---
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: estimate.projectId },
      data: {
        // Single JSONB blob — overwrite previous values; Andre edits
        // afterwards in the UI if anything's off.
        contextHints:
          toContextHintsInput({
            stories: context.stories,
            durationWeeks: context.durationWeeks,
            siteConditions: context.siteConditions,
            requiredEquipment: context.requiredEquipment,
            winterRisk: context.winterRisk,
            permitChecklist: context.permitChecklist,
          }) ?? undefined,
      },
    });

    // Append AI assumptions to the Estimate's existing assumptions text,
    // de-duped against existing bullets (don't repeat ourselves on re-run).
    if (context.assumptions.length > 0) {
      const existing = (estimate.assumptions ?? '').trim();
      const existingLines = existing
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const existingSet = new Set(
        existingLines.map((s) => s.replace(/^[-•*]\s*/, '').toLowerCase()),
      );
      const fresh = context.assumptions
        .filter((a) => !existingSet.has(a.toLowerCase()))
        .map((a) => `- ${a}`);
      const combined = [...existingLines, ...fresh].join('\n');

      await tx.estimate.update({
        where: { id: estimate.id },
        data: {
          assumptions: combined || null,
        },
      });
    }
  });

  return NextResponse.json({
    context,
    costCents,
    tokens: {
      input: usage.input_tokens,
      output: usage.output_tokens,
      cacheRead: usage.cache_read_input_tokens ?? 0,
    },
  });
}
