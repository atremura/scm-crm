/**
 * IA-1 — Project Context Analyzer.
 *
 * Runs once per estimate (re-runnable on demand). Reads the project
 * metadata + the takeoff classification summary and, optionally, the
 * extracted text of the drawings, and infers the project-level facts
 * that downstream synthesis IAs need:
 *
 *   - Building stories + max height
 *   - Site conditions (urban, prevailing wage, HVHZ, occupied building)
 *   - Required equipment with rough schedule windows
 *   - Winter risk
 *   - Permit checklist
 *   - Proposal assumptions to print at the bottom of the proposal
 *
 * The output is structured JSON enforced by zod. Andre edits any value
 * after the run — the AI is a fast first draft, not a source of truth.
 */

import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { claude, EXTRACTION_MODEL, costForUsage } from '@/lib/claude-client';

// ============================================================
// Schema
// ============================================================

export const RequiredEquipmentSchema = z.object({
  type: z
    .string()
    .describe(
      'Specific equipment type — "26ft scissor lift", "boom lift 60ft", "scaffold + planks", "concrete pump truck", "telehandler"...'
    ),
  weeksFrom: z
    .number()
    .int()
    .nullable()
    .describe('Schedule week the equipment is needed from (1-indexed). Null if unknown.'),
  weeksTo: z
    .number()
    .int()
    .nullable()
    .describe('Schedule week the equipment is no longer needed. Null if unknown.'),
  qtyMin: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe('Minimum simultaneous units (1 lift per 3 crew members on siding, etc.)'),
  justification: z
    .string()
    .describe('Why this equipment is required for this project — cite stories, scope, access.'),
});

export const SiteConditionsSchema = z.object({
  urban: z
    .boolean()
    .describe('Tight urban site (lift permit, parking restrictions, sidewalk closure likely).'),
  lotTight: z
    .boolean()
    .describe('Limited laydown area / no driveway access — concrete pump, pre-staged material.'),
  prevailingWage: z
    .boolean()
    .describe('Public/government job triggering prevailing wage rules — hits labor rate ~+35%.'),
  hvhz: z
    .boolean()
    .describe('FL High Velocity Hurricane Zone (Miami-Dade/Broward) — ~+18% on labor + material.'),
  publicRow: z
    .boolean()
    .describe('Work over public right-of-way — extra permit + flagging.'),
  occupied: z
    .boolean()
    .describe('Occupied building during work — after-hours, dust control, tenant coordination.'),
});

export const ProjectContextSchema = z.object({
  stories: z
    .number()
    .int()
    .min(1)
    .max(50)
    .nullable()
    .describe('Number of stories in the building (above grade). Null if undetermined.'),
  maxHeightFt: z
    .number()
    .int()
    .min(8)
    .max(500)
    .nullable()
    .describe('Approximate building height in feet — drives lift size selection.'),
  durationWeeks: z
    .number()
    .int()
    .min(1)
    .max(200)
    .nullable()
    .describe('Rough construction duration in weeks. Used by histogram and equipment scheduling.'),
  siteConditions: SiteConditionsSchema,
  requiredEquipment: z
    .array(RequiredEquipmentSchema)
    .default([])
    .describe(
      'Equipment line items the estimator should add. ONLY include items genuinely needed — empty array is fine for a 1-story interior remodel.'
    ),
  winterRisk: z
    .boolean()
    .describe(
      'True if any portion of work likely overlaps with winter (Nov-Mar in MA) — enables Winter cost factor.'
    ),
  permitChecklist: z
    .array(z.string())
    .default([])
    .describe('Permits/inspections to chase — "Building permit", "Sidewalk closure", "Crane swing".'),
  assumptions: z
    .array(z.string())
    .default([])
    .describe(
      'Bullets to print on the proposal under "Notes & Assumptions" — "Includes scaffold rental for 8 weeks", "Excludes hazardous material abatement", etc.'
    ),
  reasoning: z
    .string()
    .max(2000)
    .describe('Brief explanation of how you derived the values (audit trail, ≤500 chars typical).'),
});

export type ProjectContext = z.infer<typeof ProjectContextSchema>;

// ============================================================
// Inputs
// ============================================================

export type ProjectContextInput = {
  project: {
    name: string;
    address: string | null;
    workType: string | null;
    notes: string | null;
  };
  /** Optional — if the takeoff PDF was OCR'd / extracted, the first
   *  ~5000 chars of relevant text help the IA spot stories, scope
   *  callouts, etc. Fine to pass null. */
  drawingsText: string | null;
  /** Aggregated takeoff numbers the IA uses to gauge project size + scope. */
  takeoffSummary: {
    totalEnvelopeSf: number | null;
    totalLines: number;
    byDivision: Array<{ division: string; lineCount: number; totalQty: number; uom: string }>;
    notableLines: Array<{ name: string; uom: string; quantity: number }>; // top 10 by qty
  };
  region: {
    name: string;
    stateCode: string;
  };
};

// ============================================================
// Prompt
// ============================================================

const SYSTEM_PROMPT = `You are a senior construction estimator analyzing a project before pricing.

Your job: read the project metadata + takeoff summary + (optionally) drawing-extracted text, and output structured project context that downstream pricing logic will use.

Output the JSON exactly per the schema. Be specific and conservative — when you don't know something, set the value to null and explain in reasoning. Do not invent stories or equipment that aren't supported by evidence.

Construction reasoning rules:

STORIES + HEIGHT:
- Drawings text usually contains "FIRST FLOOR PLAN", "THIRD FLOOR PLAN", floor labels — count them.
- Project name like "Kanso Plymouth (3-family)" implies 2-3 stories typical for triple-decker.
- Total envelope SF / footprint SF ≈ stories. If you have envelope but not footprint, leave stories null.

EQUIPMENT (this is the high-leverage output):
- Stories ≥ 2 with exterior siding/cladding/painting → scissor lift OR scaffold required.
  - 1 lift per ~3 crew members on the siding side.
  - Scaffold preferred on dense urban or 4+ stories with lots of trim work.
- Stories ≥ 4 → boom lift 60-80ft for cornice/parapet work.
- Concrete > 200 CY OR foundation pour with truck-access constraints → concrete pump.
- Heavy material at height (mineral wool boards, panels) → telehandler if site allows.
- Interior-only or single-story → most projects need none. Empty array is correct.
- Always provide weeksFrom/weeksTo when you can estimate. Use null when truly unknown.

SITE CONDITIONS:
- Address with city like Boston/Cambridge/Somerville → urban=true.
- "Public" or "school" or "city of" in project name/work type → prevailingWage=true.
- FL address with Miami-Dade/Broward county or HVHZ in name → hvhz=true.
- Work in occupied buildings (renovation, additions) → occupied=true.
- Sidewalk-fronted commercial/multi-family in dense area → publicRow=true.

WINTER RISK:
- MA jobs starting Sep-Feb with exterior work → likely true.
- Pure interior remodel → typically false regardless of season.
- FL → almost always false (consider hurricane window instead).

DURATION:
- Use total man-hours / typical crew size as a sanity check (~40 hr/week per worker).
- Don't make up numbers — if you can't estimate within ±50%, leave null.

PERMITS:
- Always include "Building permit" for non-trivial work.
- Add "Sidewalk closure permit" when publicRow=true.
- Add "Crane swing permit" when boom lift / crane is in equipment.
- Add "Dust containment plan" when occupied=true.

ASSUMPTIONS:
- Write 3-7 bullets the estimator can paste into the proposal.
- Be specific about INCLUDES (scaffold rental for X weeks) and EXCLUDES (hazardous material, permits, MEP if not in takeoff).
- Skip generic boilerplate — the user is a contractor who already knows.

Be specific. Cite evidence in reasoning.`;

// ============================================================
// Main
// ============================================================

export async function analyzeProjectContext(input: ProjectContextInput): Promise<{
  context: ProjectContext;
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
      format: zodOutputFormat(ProjectContextSchema as any),
    },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error('Claude returned no parsed output for the project context analysis');
  }

  return {
    context: parsed,
    usage: response.usage,
    costCents: costForUsage(response.usage),
  };
}

function buildUserMessage(input: ProjectContextInput): string {
  const { project, takeoffSummary, region } = input;

  const divisionTable = takeoffSummary.byDivision
    .map(
      (d) =>
        `  ${d.division.padEnd(28)} ${String(d.lineCount).padStart(4)} lines  ${d.totalQty.toLocaleString().padStart(12)} ${d.uom}`
    )
    .join('\n');

  const notable = takeoffSummary.notableLines
    .map((l) => `  - ${l.name} — ${l.quantity} ${l.uom}`)
    .join('\n');

  const drawingsBlock = input.drawingsText
    ? `\n# Drawings text (first ~5k chars, OCR'd)\n\n${input.drawingsText.slice(0, 5000)}\n`
    : '\n# Drawings text\n(not available — infer from metadata + takeoff only)\n';

  return `# Project metadata

Name:       ${project.name}
Address:    ${project.address ?? '(none)'}
Work type:  ${project.workType ?? '(none)'}
Region:     ${region.name} (${region.stateCode})
Notes:      ${project.notes ?? '(none)'}

# Takeoff summary

Total envelope SF: ${takeoffSummary.totalEnvelopeSf?.toLocaleString() ?? '(unknown)'}
Total lines:       ${takeoffSummary.totalLines}

By division:
${divisionTable || '  (no classifications yet)'}

Top lines by quantity:
${notable || '  (no classifications yet)'}
${drawingsBlock}
Analyze the project and output structured context per the schema.`;
}
