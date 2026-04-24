/**
 * AI estimate suggester. Calls Claude with the per-line context + the
 * full reference catalog (productivity + materials) and asks for the
 * best fit. Used to recover lines that the heuristic auto-pricing
 * either missed or matched wrong.
 *
 * Caller responsibilities:
 *   - Prepare the trimmed productivity + material option lists (don't
 *     send the whole 126 / 116 verbatim if the line is small — but
 *     we DO send everything in this MVP since the catalog is small
 *     enough; trim later if the prompt gets too big).
 *   - Decide what to do with the result (auto-apply, queue for user
 *     review, etc).
 */

import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { claude, EXTRACTION_MODEL, costForUsage } from '@/lib/claude-client';

// ============================================================
// Schema
// ============================================================

export const CustomMaterialSchema = z.object({
  name: z.string().describe('Descriptive name of the material'),
  qty: z.number().nonnegative().describe('Quantity (already including waste)'),
  uom: z.string().describe('Unit of measure (SF, LF, EA, BX, GAL, ...)'),
  estimatedUnitCostCents: z
    .number()
    .nonnegative()
    .describe('Best-guess unit cost in cents (USD)'),
  wastePercent: z
    .number()
    .min(0)
    .max(100)
    .default(5)
    .describe('Waste % already applied to qty (5 means 5%)'),
  note: z.string().optional().describe('Optional context for the user'),
});

export const AiLineSuggestionSchema = z.object({
  productivityId: z
    .string()
    .nullable()
    .describe(
      'UUID of the chosen productivity entry from the provided list, or null if none fits.'
    ),
  productivityReason: z
    .string()
    .describe('Short explanation of why this productivity entry (or why none).'),

  materialId: z
    .string()
    .nullable()
    .describe(
      'UUID of the single best material from the catalog, or null if none fits / scope is service-only.'
    ),
  materialReason: z
    .string()
    .describe('Short explanation of the material pick (or why none).'),

  customMaterials: z
    .array(CustomMaterialSchema)
    .default([])
    .describe(
      'Additional materials NOT in the catalog. Use sparingly — only when the catalog clearly lacks the right item. Each entry is a best-guess price; the user will verify.'
    ),

  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe('0-100 confidence in this combined suggestion.'),

  needsHumanReview: z
    .boolean()
    .describe(
      'True if the line is unusual, ambiguous, or you used customMaterials. The UI will flag it.'
    ),

  warnings: z
    .array(z.string())
    .default([])
    .describe('Specific things the user should double-check before accepting.'),
});

export type AiLineSuggestion = z.infer<typeof AiLineSuggestionSchema>;

// ============================================================
// Inputs
// ============================================================

export type SuggesterInput = {
  classification: {
    name: string;
    scope: string;
    uom: string;
    quantity: number;
    externalId?: string | null;
  };
  project: {
    name: string;
    address?: string | null;
    workType?: string | null;
  };
  productivityOptions: Array<{
    id: string;
    division: string;
    scopeName: string;
    uom: string;
    mhPerUnitAvg: number;
  }>;
  materialOptions: Array<{
    id: string;
    division: string | null;
    name: string;
    uom: string;
    avgCents: number;
    wastePercent: number;
  }>;
};

// ============================================================
// Prompt
// ============================================================

const SYSTEM_PROMPT = `You are a senior construction estimator pricing line items from a takeoff.

For each takeoff classification given to you, you pick:
1. The single closest productivity entry from the provided list (man-hours per unit) — by trade match, scope match, and UOM compatibility. If nothing in the list is reasonably close, return productivityId=null.
2. The single closest material from the catalog if scope is "service_and_material". You may also propose customMaterials when the catalog clearly lacks an item — but only when needed; prefer catalog items.

Be CONSERVATIVE. When unsure:
- Set needsHumanReview=true and explain why in warnings.
- It's better to leave productivityId=null than guess wrong.

Construction terms you must understand:
- "Pocket door" — slides INTO a wall pocket; needs door slab + pocket-door rough-in kit. NOT the same as exterior pre-hung door.
- "Slider / sliding patio door" — glass door on a track, exterior; different productivity than swing door.
- "Vanity" — bathroom cabinet/sink combo; this is cabinetry/finish carpentry, NOT tile work.
- "Baseboard" — trim at floor edge; MDF (paint-grade) is cheaper than hardwood (stain-grade). Match by material if hinted.
- "Sill" — bottom horizontal piece of an opening (window or door). Window sill work is finish carpentry/flashing, not framing.
- "Casing" — trim around door/window openings.
- "Crown" — molding at ceiling/wall transition.
- "Wire shelf" — wire closet shelving; usually finish carpentry install, sold by LF.
- "Floor white oak" — hardwood flooring; specific species matters for material cost.
- "Engineered" vs "solid" hardwood — different products, different prices.
- "Set toilet / vanity / fixture" — plumbing fixture install, NOT tile.
- "Rough-in" vs "trim out" — early-stage vs final-stage trade work; pick accordingly.

UOM RULES:
- The productivity UOM should match (or be closely compatible with) the takeoff UOM. SF productivity for SF takeoff. LF for LF. EA for EA.
- If the only close match has the wrong UOM, return null and warn — don't force it.

Output structured JSON exactly per the schema. Be specific in reasons (cite the productivity scopeName or material name). Keep reasons under 200 chars each.`;

// ============================================================
// Main
// ============================================================

export async function suggestForLine(input: SuggesterInput): Promise<{
  suggestion: AiLineSuggestion;
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
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
    output_config: {
      // The SDK's zodOutputFormat helper only takes the schema in our
      // installed version; passing a name kw arg here is rejected.
      format: zodOutputFormat(AiLineSuggestionSchema as any),
    },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error('Claude returned no parsed output for the line suggestion');
  }

  return {
    suggestion: parsed,
    usage: response.usage,
    costCents: costForUsage(response.usage),
  };
}

function buildUserMessage(input: SuggesterInput): string {
  const c = input.classification;

  const prodLines = input.productivityOptions
    .map(
      (p) =>
        `${p.id} | ${p.division} | ${p.uom.padEnd(10)} | MHavg=${p.mhPerUnitAvg.toFixed(4).padStart(8)} | ${p.scopeName}`
    )
    .join('\n');

  const matLines = input.materialOptions
    .map(
      (m) =>
        `${m.id} | ${(m.division ?? '-').padEnd(20)} | ${m.uom.padEnd(6)} | $${(m.avgCents / 100).toFixed(2).padStart(9)} | waste=${m.wastePercent}% | ${m.name}`
    )
    .join('\n');

  return `# Takeoff line to price

Name:        ${c.name}
External ID: ${c.externalId ?? '(none)'}
Scope:       ${c.scope}
Quantity:    ${c.quantity} ${c.uom}

# Project
${input.project.name}
${input.project.address ? `Address:   ${input.project.address}\n` : ''}${input.project.workType ? `Work type: ${input.project.workType}\n` : ''}
# Available productivity entries
Format: id | division | uom | MH/unit avg | scope name

${prodLines}

# Available materials
Format: id | division | uom | $/unit avg | waste% | name

${matLines}

Pick the best productivity (and material if scope requires) for the takeoff line. Cite the matched scope/material name in your reason.`;
}
