/**
 * Single source of truth for scope-analyst prompt version.
 *
 * Bump rules (semver-ish for prompts):
 *   MAJOR — output schema (Zod) shape changed
 *   MINOR — base prompt rewritten / new instructions / new fields
 *   PATCH — copy tweaks, examples, formatting nits
 *
 * Every ProjectAnalysisRun persists this string. Lets us compare
 * accuracy between versions and rollback regressions cheaply.
 */
export const PROMPT_VERSION = '1.0.0';

/**
 * Changelog
 * ---------
 * 1.0.0 (2026-05-01) — Initial release.
 *   - Opus 4.7 primary, Sonnet 4.6 fallback.
 *   - EN-only output (hard requirement).
 *   - Tool-use forced via submit_scope tool.
 *   - quantity_basis mandatory on every line.
 *   - Confidence bands: <0.6 (low), 0.6–0.85 (mid), >0.85 (high).
 */
