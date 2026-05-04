/**
 * Pricing per million tokens (cents). Confirm against
 * https://docs.anthropic.com/en/docs/about-claude/pricing before
 * each model rotation. Numbers below are accurate as of 2026-05-01
 * for the Opus 4.x and Sonnet 4.x families on Pay-As-You-Go.
 *
 * Cache write tier here is 5-minute ephemeral. Switch to 1h tier
 * (3.0× input) only if scope analysis turns into a long-running
 * conversation — not relevant for single-shot runs.
 */

export type ModelPricing = {
  inputCentsPerMillion: number;
  outputCentsPerMillion: number;
  cacheReadCentsPerMillion: number;
  cacheWriteCentsPerMillion: number;
};

// Opus 4.7 — aligned with src/lib/claude-client.ts (single source of truth
// for the existing IA-1 / IA-2 pipelines).
const OPUS_PRICING: ModelPricing = {
  inputCentsPerMillion: 500, // $5 / Mtok
  outputCentsPerMillion: 2500, // $25 / Mtok
  cacheReadCentsPerMillion: 50, // ~10% of input
  cacheWriteCentsPerMillion: 625, // ~1.25× input
};

// Sonnet 4.6 — fallback model for the calibration A/B run.
const SONNET_PRICING: ModelPricing = {
  inputCentsPerMillion: 300, // $3 / Mtok
  outputCentsPerMillion: 1500, // $15 / Mtok
  cacheReadCentsPerMillion: 30, // $0.30 / Mtok
  cacheWriteCentsPerMillion: 375, // $3.75 / Mtok
};

export function pickPricing(modelId: string): ModelPricing {
  if (modelId.startsWith('claude-opus')) return OPUS_PRICING;
  if (modelId.startsWith('claude-sonnet')) return SONNET_PRICING;
  // Unknown model: assume Opus (worst-case for cost reporting — the
  // safer side to err on if we're billing back to a tenant).
  return OPUS_PRICING;
}

export type TokenCounts = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

/**
 * Returns cost in cents, rounded to 4 decimal places (matches the
 * Decimal(10,4) column in `project_analysis_runs.cost_cents`).
 */
export function calculateCostCents(modelId: string, tokens: TokenCounts): number {
  const p = pickPricing(modelId);
  const cents =
    (tokens.inputTokens / 1_000_000) * p.inputCentsPerMillion +
    (tokens.outputTokens / 1_000_000) * p.outputCentsPerMillion +
    (tokens.cacheReadTokens / 1_000_000) * p.cacheReadCentsPerMillion +
    (tokens.cacheWriteTokens / 1_000_000) * p.cacheWriteCentsPerMillion;
  return Math.round(cents * 10_000) / 10_000;
}
