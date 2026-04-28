/**
 * IA-2 — Hidden Cost Detector.
 *
 * Runs ONLY for productivities that the deterministic rules engine
 * (derivative-rules-engine.ts) couldn't cover. Asks Claude to propose:
 *
 *   1. Derivative line items to add to THIS estimate immediately.
 *   2. New DerivativeCostRule rows the company should add to its
 *      catalog so future estimates handle the same productivity
 *      deterministically (no AI call needed next time).
 *
 * Pattern: AI proposes, Andre approves. Rule proposals land as
 * Suggestion rows (status='pending'). Andre approves them in admin
 * → system materializes the rule.
 *
 * Cost: ~$0.50/run on a Kanso-sized project. Only needs to run when
 * the catalog has gaps. Once a tenant has 50-100 rules in the catalog
 * (5-10 per division), IA-2 mostly just confirms there's nothing to add.
 */

import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { claude, EXTRACTION_MODEL, costForUsage } from '@/lib/claude-client';

// ============================================================
// Schema
// ============================================================

const DerivativeFormulaSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('qty_per_unit'),
    factor: z
      .number()
      .positive()
      .describe('Multiplier — derivative qty = trigger qty × factor.'),
    uomIn: z.string().describe('UOM of the trigger line (SF, LF, EA).'),
    uomOut: z.string().describe('UOM of the derivative line (BX, LF, EA, GAL).'),
  }),
  z.object({
    kind: z.literal('percent_of_direct'),
    percent: z.number().min(0).max(50),
    basis: z.enum(['labor', 'material', 'subtotal']),
  }),
  z.object({
    kind: z.literal('fixed_per_week'),
    cents: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('count_per_opening'),
    perUnit: z.number().positive(),
    uomOut: z.string(),
  }),
  z.object({
    kind: z.literal('lump_sum'),
    cents: z.number().int().nonnegative(),
  }),
]);

export const HiddenCostLineProposalSchema = z.object({
  parentLineId: z
    .string()
    .describe('Id of the explicit estimate line this derivative hangs under.'),
  name: z.string().describe('Descriptive name — "Hardie ring-shank fasteners".'),
  costType: z.enum(['material', 'labor', 'site', 'cleanup']),
  quantity: z.number().positive(),
  uom: z.string(),
  unitCostCents: z.number().int().nonnegative(),
  subtotalCents: z.number().int().nonnegative(),
  reason: z.string().max(400),
});

export const RuleProposalSchema = z.object({
  /** Proposed name of the rule when persisted in DerivativeCostRule */
  name: z.string().describe('Catalog-grade name — "Hardie smooth siding fasteners".'),
  triggerProductivityMatchCode: z
    .string()
    .nullable()
    .describe(
      'Preferred trigger — the matchCode of the productivity it applies to (e.g. "ELFCS"). Null if the rule applies to a whole division.'
    ),
  triggerDivisionId: z
    .string()
    .nullable()
    .describe('Fallback trigger — applies to every line in this division.'),
  costType: z.enum(['material', 'labor', 'site', 'cleanup']),
  formula: DerivativeFormulaSchema,
  materialIdRef: z
    .string()
    .nullable()
    .describe('Material catalog id this rule references (when formula is qty_per_unit or count_per_opening).'),
  uomIn: z.string().nullable(),
  uomOut: z.string().nullable(),
  notes: z.string().max(600).describe('Why this rule is reasonable + sources / common-sense ratios.'),
});

export const HiddenCostsResultSchema = z.object({
  derivativeLines: z
    .array(HiddenCostLineProposalSchema)
    .default([])
    .describe(
      'Lines to add to this estimate immediately. Use SPARINGLY — only items genuinely missing from the takeoff. Empty is a valid answer.'
    ),
  newRules: z
    .array(RuleProposalSchema)
    .default([])
    .describe(
      'NEW DerivativeCostRule rows to propose for the company catalog. Andre approves them in admin. Each rule should map cleanly to one productivity matchCode or division.'
    ),
  reasoning: z.string().max(2000),
});

export type HiddenCostsResult = z.infer<typeof HiddenCostsResultSchema>;
export type RuleProposal = z.infer<typeof RuleProposalSchema>;
export type HiddenCostLineProposal = z.infer<typeof HiddenCostLineProposalSchema>;

// ============================================================
// Inputs
// ============================================================

export type HiddenCostsInput = {
  estimate: {
    id: string;
    region: string;
    durationWeeks: number | null;
    stories: number | null;
    siteConditions: Record<string, boolean> | null;
    directCostCents: number;
  };
  /**
   * The estimate's lines that the deterministic rules engine couldn't
   * cover (productivity has no rule). IA-2 looks at these specifically.
   */
  uncoveredLines: Array<{
    id: string;
    name: string;
    externalId: string | null;
    uom: string;
    quantity: number;
    productivityMatchCode: string | null;
    productivityDivision: string | null;
    productivityScopeName: string | null;
    laborCostCents: number | null;
    materialCostCents: number | null;
  }>;
  /**
   * Existing rules — IA-2 sees them so it knows what's already covered
   * and doesn't re-propose duplicates.
   */
  existingRules: Array<{
    name: string;
    triggerProductivityMatchCode: string | null;
    triggerDivisionName: string | null;
    formulaKind: string;
  }>;
  /**
   * Material catalog — IA-2 references real material ids when proposing
   * qty_per_unit / count_per_opening rules. If the right material isn't
   * in the catalog, the AI can leave materialIdRef null and explain in
   * notes (Andre adds the material first, then approves the rule).
   */
  materials: Array<{
    id: string;
    name: string;
    uom: string;
    avgCents: number;
    division: string | null;
  }>;
  /**
   * Divisions — IA-2 uses ids when proposing division-level rules.
   */
  divisions: Array<{ id: string; name: string }>;
};

// ============================================================
// Prompt
// ============================================================

const SYSTEM_PROMPT = `You are a senior construction estimator looking for cost items that are ALWAYS needed but RARELY appear in takeoffs. Your job is to find what's missing.

Common missing categories:

FASTENERS / HARDWARE (per material):
- Hardie smooth siding (matchCode prefix ELFCS): ring-shank nails ~0.025 boxes per SF (1 box = 1000 nails covers ~40 SF).
- Hardie shake (ELFCSS): same fastener, slightly higher rate (~0.028/SF, smaller exposure).
- Hardie panel (ELFCP): 0.020 boxes per SF.
- Drywall hanging: 1 lb screws per ~100 SF; fine-thread for metal studs.
- Framing: 10 lb common nails per 100 BF rough lumber.
- Subfloor: 10 lb screws per 100 SF (deck screws).
- Trim: 50 finish nails per LF baseboard / casing (1 box = 2500 nails).

TAPE / SEALANT:
- House wrap (Tyvek): tape = 1 LF per ~6 SF wrap (seam coverage).
- Rainscreen / EPDM tape on furring: 1 LF tape per LF furring.
- Caulk for exterior trim joints: ~1 tube per 30 LF trim.
- Window/door perimeter sealant: 2-3 tubes per opening.

CONSUMABLES (% of material cost):
- Blade replacement, sandpaper, drill bits: 2-3% of total material direct cost.
- Painter prep (dropcloth, masking, plastic): 4-5% of paint material.

SITE COSTS (fixed per week):
- Dumpster (15-yard): $550-700/week, 1 swap/week typical for renovation.
- Port-a-john: $150-200/month → ~$45/week.
- Temp power if not on site: $100-200/week.

CLEANUP:
- Final clean: $0.20-0.40 per SF total floor area.
- Daily debris removal: include in dumpster line, not separate.

EQUIPMENT (already covered by IA-1; do NOT re-propose lifts/scaffolds here).

OUTPUT RULES:
- Be CONSERVATIVE. Empty array is fine when nothing's missing.
- Don't double-charge — if the existingRules list shows a fastener rule for ELFCS already, do NOT re-propose it.
- Each newRule should be SPECIFIC: prefer triggerProductivityMatchCode over triggerDivisionId.
- For qty_per_unit and count_per_opening, you MUST cite a real materialIdRef from the materials list. If the material doesn't exist, leave materialIdRef null and explain in notes — Andre will add the material before approving.
- Lump-sum rules are last resort — prefer rate-based formulas.
- Be DISTINCT: if you propose a rule (long-term solution), don't ALSO propose the corresponding derivative line (it'll be inserted from the rule once approved). EXCEPTION: site costs the user wants on THIS estimate even before the rule is approved — propose both, Andre approves rule once, line is already there.

Be concrete. Cite ratios in notes. Reasoning gets logged for audit.`;

// ============================================================
// Main
// ============================================================

export async function detectHiddenCosts(input: HiddenCostsInput): Promise<{
  result: HiddenCostsResult;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
  costCents: number;
}> {
  const userMessage = buildUserMessage(input);

  const response = await claude().messages.parse({
    model: EXTRACTION_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
    output_config: {
      format: zodOutputFormat(HiddenCostsResultSchema as any),
    },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error('Claude returned no parsed output for the hidden cost detection');
  }

  return {
    result: parsed,
    usage: response.usage,
    costCents: costForUsage(response.usage),
  };
}

function buildUserMessage(input: HiddenCostsInput): string {
  const { estimate, uncoveredLines, existingRules, materials, divisions } = input;

  const linesBlock = uncoveredLines
    .map(
      (l) =>
        `${l.id} | ${l.productivityMatchCode ?? '?'} | ${(l.productivityDivision ?? '?').padEnd(20)} | ${l.uom} | ${l.quantity} | $${((l.laborCostCents ?? 0) / 100).toFixed(0)} labor + $${((l.materialCostCents ?? 0) / 100).toFixed(0)} material | ${l.name}`
    )
    .join('\n');

  const rulesBlock = existingRules.length
    ? existingRules
        .map(
          (r) =>
            `  - ${r.name} [trigger: ${r.triggerProductivityMatchCode ?? r.triggerDivisionName ?? 'project'}] (${r.formulaKind})`
        )
        .join('\n')
    : '  (none yet — every productivity in the lines list is a candidate for a new rule)';

  const materialsBlock = materials
    .slice(0, 80) // cap to prevent token bloat
    .map(
      (m) =>
        `  ${m.id} | ${(m.division ?? '-').padEnd(18)} | ${m.uom.padEnd(4)} | $${(m.avgCents / 100).toFixed(2)} | ${m.name}`
    )
    .join('\n');

  const divisionsBlock = divisions
    .map((d) => `  ${d.id} | ${d.name}`)
    .join('\n');

  const conditions = estimate.siteConditions
    ? Object.keys(estimate.siteConditions)
        .filter((k) => estimate.siteConditions![k])
        .join(', ') || 'none flagged'
    : 'none flagged';

  return `# Estimate context

Region:           ${estimate.region}
Stories:          ${estimate.stories ?? '?'}
Duration weeks:   ${estimate.durationWeeks ?? '?'}
Site conditions:  ${conditions}
Direct cost:      $${(estimate.directCostCents / 100).toLocaleString()}

# Uncovered lines (no rule yet — IA-2 looks at these)
Format: lineId | matchCode | division | uom | qty | labor + material | name

${linesBlock || '  (no uncovered lines — engine handled everything)'}

# Existing rules (don't duplicate these)

${rulesBlock}

# Available divisions (for triggerDivisionId)

${divisionsBlock}

# Material catalog (for materialIdRef in qty_per_unit / count_per_opening)

${materialsBlock}

Propose:
  1. derivativeLines — items to add to THIS estimate immediately. Use sparingly.
  2. newRules — DerivativeCostRule rows to seed the company catalog so future estimates handle these productivities deterministically.

If everything's already covered, return empty arrays + a one-line reasoning saying so.`;
}
