import { z } from 'zod';

/**
 * Output contract for the scope-analyst tool call. The model MUST
 * return JSON matching this exact shape — anything else is rejected
 * upstream (run gets status='failed').
 *
 * Shared between:
 *   - run.ts                          (parses the API tool_use response)
 *   - api/projects/[id]/analyze       (validates before persisting)
 *   - api/projects/[id]/analysis-runs/[runId]/accept (re-reads from DB)
 *
 * Keep this file dependency-free other than zod. The base-prompt
 * mirrors this schema in plain English for the model — bumping any
 * shape here MUST bump PROMPT_VERSION major.
 */

export const ScopeAnalystUom = z.enum(['SF', 'LF', 'EA', 'SQ', 'CY', 'TON']);
export type ScopeAnalystUom = z.infer<typeof ScopeAnalystUom>;

export const ScopeAnalystType = z.enum(['area', 'linear', 'count']);
export type ScopeAnalystType = z.infer<typeof ScopeAnalystType>;

export const ScopeAnalystScope = z.enum(['service', 'service_and_material']);
export type ScopeAnalystScope = z.infer<typeof ScopeAnalystScope>;

export const PreliminaryClassification = z.object({
  /** Human-readable item name (e.g. "James Hardie Fiber Cement Siding 8\""). */
  name: z.string().min(2).max(120),
  /**
   * Candidate matchCode (e.g. "ELFCS", "EL02", "A1") — must match an
   * entry in the tenant catalog provided in the prompt, or null.
   */
  external_id: z.string().nullable(),
  type: ScopeAnalystType,
  uom: ScopeAnalystUom,
  /** Numeric quantity. Use floats; never strings. Non-negative. */
  quantity: z.number().nonnegative(),
  /**
   * MANDATORY narrative explaining how the model arrived at the qty.
   * Example: "Calculated: 80'×30' wall = 2,400 SF gross - 12 windows
   * × 32 SF = 2,016 SF net". Items missing this are rejected.
   */
  quantity_basis: z.string().min(10),
  scope: ScopeAnalystScope,
  /** Division name from the tenant catalog (e.g. "Siding"). Null if uncertain. */
  division_hint: z.string().nullable(),
  /** ProductivityEntry matchCode (e.g. "ELFCS"). NULL if not confident — never invent. */
  productivity_hint: z.string().nullable(),
  /** Material name from the tenant catalog. Null if not confident. */
  material_hint: z.string().nullable(),
  /** 0..1 — see prompt for calibration bands. */
  confidence: z.number().min(0).max(1),
  /** Where in the documents the qty came from (e.g. "Sheet A2.1, North Elevation"). */
  source_reference: z.string(),
  notes: z.string().nullable(),
});
export type PreliminaryClassification = z.infer<typeof PreliminaryClassification>;

export const ScopeAnalystOutput = z.object({
  /** 50–2000 chars. Plain English. Read once, edit nothing. */
  project_summary: z.string().min(50).max(2000),
  /** Up to 20 bullets of risks/gotchas the estimator should know. */
  critical_points: z.array(z.string()).max(20),
  /** Up to 20 questions the estimator must resolve before bidding. */
  unresolved_questions: z.array(z.string()).max(20),
  /** Up to 200 line items proposed for inclusion. */
  preliminary_classifications: z.array(PreliminaryClassification).max(200),
});
export type ScopeAnalystOutput = z.infer<typeof ScopeAnalystOutput>;

/**
 * Tool definition fed to the Anthropic API. The JSON schema below is
 * derived by hand from the Zod above — keep them in sync. zod-to-json-schema
 * is overkill here.
 */
export const SUBMIT_SCOPE_TOOL = {
  name: 'submit_scope',
  description:
    'Submit the structured scope analysis for the project. Call this exactly once with the full output.',
  input_schema: {
    type: 'object' as const,
    required: [
      'project_summary',
      'critical_points',
      'unresolved_questions',
      'preliminary_classifications',
    ],
    properties: {
      project_summary: {
        type: 'string',
        minLength: 50,
        maxLength: 2000,
      },
      critical_points: {
        type: 'array',
        maxItems: 20,
        items: { type: 'string' },
      },
      unresolved_questions: {
        type: 'array',
        maxItems: 20,
        items: { type: 'string' },
      },
      preliminary_classifications: {
        type: 'array',
        maxItems: 200,
        items: {
          type: 'object',
          required: [
            'name',
            'external_id',
            'type',
            'uom',
            'quantity',
            'quantity_basis',
            'scope',
            'division_hint',
            'productivity_hint',
            'material_hint',
            'confidence',
            'source_reference',
            'notes',
          ],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 120 },
            external_id: { type: ['string', 'null'] },
            type: { type: 'string', enum: ['area', 'linear', 'count'] },
            uom: {
              type: 'string',
              enum: ['SF', 'LF', 'EA', 'SQ', 'CY', 'TON'],
            },
            quantity: { type: 'number', minimum: 0 },
            quantity_basis: { type: 'string', minLength: 10 },
            scope: {
              type: 'string',
              enum: ['service', 'service_and_material'],
            },
            division_hint: { type: ['string', 'null'] },
            productivity_hint: { type: ['string', 'null'] },
            material_hint: { type: ['string', 'null'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            source_reference: { type: 'string' },
            notes: { type: ['string', 'null'] },
          },
        },
      },
    },
  },
} as const;
