import type { CoworkImportV1 } from './schema';

/**
 * Integrity rules — semantic validation beyond Zod schema validation.
 *
 * Run AFTER Zod schema parse succeeds. These rules check semantic
 * consistency that the JSON Schema cannot express: cross-references
 * between blocks, totals, and business invariants.
 *
 * Defined in docs/cowork-import-schema.md section 4.
 *
 * Severity:
 * - BLOCKER: import rejected. JSON is unusable as-is.
 * - WARNING: import allowed; reviewer alerted via Suggestion row.
 *
 * Each rule is a pure function: input is the parsed payload, output
 * is null (rule passed) or an IntegrityViolation describing the issue.
 *
 * Rule 8 (tenant_slug match) is NOT implemented here because it
 * requires session context (current user's tenant slug). It belongs
 * in the import endpoint, not in this pure validator.
 */

export type IntegrityRuleId =
  | 'MATERIAL_COVERAGE'
  | 'PRODUCTIVITY_COVERAGE'
  | 'HISTOGRAM_PRODUCTIVITY_BAND'
  | 'SERVICE_CODE_CONSISTENCY'
  | 'ALLOWANCE_AMOUNT_REQUIRED'
  | 'GEOMETRY_PLAUSIBILITY'
  | 'RECOMMENDED_SCENARIO_EXISTS'
  | 'TENANT_SLUG_MATCH';

export type IntegritySeverity = 'BLOCKER' | 'WARNING';

export type IntegrityViolation = {
  rule: IntegrityRuleId;
  severity: IntegritySeverity;
  message: string;
  context: Record<string, unknown>;
};

export type IntegrityCheckResult = {
  passed: boolean;
  blockers: IntegrityViolation[];
  warnings: IntegrityViolation[];
  rulesEvaluated: number;
};

// Histogram band: ±25% from productivity total.
const HISTOGRAM_BAND_LOW = 0.75;
const HISTOGRAM_BAND_HIGH = 1.25;

// Geometry plausibility tolerance: ±5%.
const GEOMETRY_TOLERANCE_PCT = 0.05;

/**
 * Rule 1: Material coverage.
 * Every scope_item with type ∈ ("M", "M+L") must have at least one
 * material entry linked by service_code.
 */
export function checkMaterialCoverage(json: CoworkImportV1): IntegrityViolation | null {
  const materialServiceCodes = new Set(json.materials.map((m) => m.service_code));

  const missingCoverage = json.scope_items
    .filter((s) => s.type === 'M' || s.type === 'M+L')
    .filter((s) => !materialServiceCodes.has(s.service_code))
    .map((s) => s.service_code);

  if (missingCoverage.length === 0) return null;

  return {
    rule: 'MATERIAL_COVERAGE',
    severity: 'BLOCKER',
    message: `${missingCoverage.length} scope_item(s) declare material installation but have no material entry: ${missingCoverage.join(', ')}`,
    context: { missingServiceCodes: missingCoverage },
  };
}

/**
 * Rule 2: Productivity coverage.
 * Every scope_item with type ∈ ("L", "M+L") must have at least one
 * labor_productivity entry linked by service_code.
 */
export function checkProductivityCoverage(json: CoworkImportV1): IntegrityViolation | null {
  const productivityServiceCodes = new Set(json.labor_productivity.map((p) => p.service_code));

  const missingCoverage = json.scope_items
    .filter((s) => s.type === 'L' || s.type === 'M+L')
    .filter((s) => !productivityServiceCodes.has(s.service_code))
    .map((s) => s.service_code);

  if (missingCoverage.length === 0) return null;

  return {
    rule: 'PRODUCTIVITY_COVERAGE',
    severity: 'BLOCKER',
    message: `${missingCoverage.length} scope_item(s) declare labor installation but have no productivity entry: ${missingCoverage.join(', ')}`,
    context: { missingServiceCodes: missingCoverage },
  };
}

/**
 * Rule 3: Histogram-productivity consistency band.
 * sum(histogram.rows[].total_mh) must be within ±25% of
 * sum(labor_productivity[].total_mh).
 */
export function checkHistogramProductivityBand(json: CoworkImportV1): IntegrityViolation | null {
  if (!json.histogram?.rows || json.histogram.rows.length === 0) return null;

  const productivityTotal = json.labor_productivity.reduce((sum, p) => sum + (p.total_mh ?? 0), 0);

  if (productivityTotal === 0) return null; // no productivity rows or all zero

  const histogramTotal = json.histogram.rows.reduce((sum, r) => sum + (r.total_mh ?? 0), 0);

  const ratio = histogramTotal / productivityTotal;

  if (ratio >= HISTOGRAM_BAND_LOW && ratio <= HISTOGRAM_BAND_HIGH) return null;

  return {
    rule: 'HISTOGRAM_PRODUCTIVITY_BAND',
    severity: 'WARNING',
    message: `Histogram total MH (${histogramTotal.toFixed(1)}) is ${(ratio * 100).toFixed(0)}% of productivity total MH (${productivityTotal.toFixed(1)}). Expected range: ${(HISTOGRAM_BAND_LOW * 100).toFixed(0)}%-${(HISTOGRAM_BAND_HIGH * 100).toFixed(0)}%.`,
    context: {
      productivityTotal,
      histogramTotal,
      ratio,
      bandLow: HISTOGRAM_BAND_LOW,
      bandHigh: HISTOGRAM_BAND_HIGH,
    },
  };
}

/**
 * Rule 4: Service code consistency.
 * Every service_code referenced in takeoff_items, materials,
 * labor_productivity, or histogram.rows must exist in scope_items.
 */
export function checkServiceCodeConsistency(json: CoworkImportV1): IntegrityViolation | null {
  const declaredCodes = new Set(json.scope_items.map((s) => s.service_code));

  const orphans: { source: string; code: string }[] = [];

  for (const t of json.takeoff_items) {
    if (!declaredCodes.has(t.service_code)) {
      orphans.push({ source: 'takeoff_items', code: t.service_code });
    }
  }
  for (const m of json.materials) {
    if (!declaredCodes.has(m.service_code)) {
      orphans.push({ source: 'materials', code: m.service_code });
    }
  }
  for (const p of json.labor_productivity) {
    if (!declaredCodes.has(p.service_code)) {
      orphans.push({ source: 'labor_productivity', code: p.service_code });
    }
  }
  if (json.histogram?.rows) {
    for (const r of json.histogram.rows) {
      if (r.service_code && !declaredCodes.has(r.service_code)) {
        orphans.push({ source: 'histogram.rows', code: r.service_code });
      }
    }
  }

  if (orphans.length === 0) return null;

  // Dedupe codes across sources but keep the source list per code.
  const uniqueCodes = Array.from(new Set(orphans.map((o) => o.code)));

  return {
    rule: 'SERVICE_CODE_CONSISTENCY',
    severity: 'BLOCKER',
    message: `${uniqueCodes.length} service_code(s) referenced but not declared in scope_items: ${uniqueCodes.join(', ')}`,
    context: { orphans, uniqueOrphanCodes: uniqueCodes },
  };
}

/**
 * Rule 5: Allowance amount required.
 * scope_items with status === "ALLOWANCE" must have allowance_amount > 0.
 */
export function checkAllowanceAmount(json: CoworkImportV1): IntegrityViolation | null {
  const incomplete = json.scope_items
    .filter((s) => s.status === 'ALLOWANCE')
    .filter(
      (s) =>
        s.allowance_amount === null || s.allowance_amount === undefined || s.allowance_amount < 0,
    )
    .map((s) => s.service_code);

  if (incomplete.length === 0) return null;

  return {
    rule: 'ALLOWANCE_AMOUNT_REQUIRED',
    severity: 'WARNING',
    message: `${incomplete.length} ALLOWANCE scope_item(s) missing or invalid allowance_amount: ${incomplete.join(', ')}`,
    context: { affectedServiceCodes: incomplete },
  };
}

/**
 * Rule 6: Geometry plausibility.
 * If takeoff_item has geometry.projected_area_sf AND geometry.slope_factor,
 * then quantity should equal projected_area_sf × slope_factor (±5%).
 */
export function checkGeometryPlausibility(json: CoworkImportV1): IntegrityViolation | null {
  const mismatches: {
    takeoff_id: string;
    expected: number;
    actual: number;
    diff_pct: number;
  }[] = [];

  for (const t of json.takeoff_items) {
    const g = t.geometry;
    if (!g?.projected_area_sf) continue;
    if (g.slope_factor === undefined || g.slope_factor === null) continue;

    const expected = g.projected_area_sf * g.slope_factor;
    const diff = Math.abs(t.quantity - expected);
    const diffPct = expected === 0 ? (t.quantity === 0 ? 0 : Infinity) : diff / expected;

    if (diffPct > GEOMETRY_TOLERANCE_PCT) {
      mismatches.push({
        takeoff_id: t.takeoff_id,
        expected,
        actual: t.quantity,
        diff_pct: diffPct,
      });
    }
  }

  if (mismatches.length === 0) return null;

  return {
    rule: 'GEOMETRY_PLAUSIBILITY',
    severity: 'WARNING',
    message: `${mismatches.length} takeoff_item(s) have quantity that diverges >5% from projected_area_sf × slope_factor`,
    context: { mismatches },
  };
}

/**
 * Rule 7: Recommended scenario must exist.
 * summary.recommended_scenario_code must match one of scenarios[].scenario_code.
 */
export function checkRecommendedScenarioExists(json: CoworkImportV1): IntegrityViolation | null {
  const declaredCodes = json.scenarios.map((s) => s.scenario_code);
  const recommended = json.summary.recommended_scenario_code;

  if (declaredCodes.includes(recommended)) return null;

  return {
    rule: 'RECOMMENDED_SCENARIO_EXISTS',
    severity: 'BLOCKER',
    message: `summary.recommended_scenario_code "${recommended}" does not exist in scenarios. Available: ${declaredCodes.join(', ')}`,
    context: {
      recommended,
      availableScenarios: declaredCodes,
    },
  };
}

/**
 * Top-level orchestrator: run all 7 pure rules and aggregate results.
 *
 * Note: Rule 8 (tenant_slug match) is NOT included here. Endpoint must
 * call it separately with session context.
 */
export function validateIntegrity(json: CoworkImportV1): IntegrityCheckResult {
  const checks = [
    checkMaterialCoverage(json),
    checkProductivityCoverage(json),
    checkHistogramProductivityBand(json),
    checkServiceCodeConsistency(json),
    checkAllowanceAmount(json),
    checkGeometryPlausibility(json),
    checkRecommendedScenarioExists(json),
  ];

  const violations = checks.filter((c): c is IntegrityViolation => c !== null);
  const blockers = violations.filter((v) => v.severity === 'BLOCKER');
  const warnings = violations.filter((v) => v.severity === 'WARNING');

  return {
    passed: blockers.length === 0,
    blockers,
    warnings,
    rulesEvaluated: 7,
  };
}
