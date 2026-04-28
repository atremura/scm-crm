/**
 * Deterministic engine that turns explicit estimate lines into the
 * "implicit" cost lines they imply — fasteners for siding, screws for
 * drywall, EPDM tape for rainscreen, dumpster fees, cleanup labor, etc.
 *
 * Reads DerivativeCostRule rows scoped to the company, finds the ones
 * whose trigger matches each line's productivity (by matchCode or
 * division), evaluates the formula JSON, and emits a list of proposed
 * derivative EstimateLine values.
 *
 * Pure functions, no Prisma. The route loads rules + lines, calls this
 * to compute proposals, and persists.
 *
 * Hybrid pipeline:
 *   1. THIS engine handles every (productivity, rule) match deterministically.
 *   2. For lines whose productivity has NO rule, the IA-2 wrapper runs
 *      (ai-hidden-costs.ts) and proposes both:
 *         a. derivative lines for THIS estimate (used immediately), AND
 *         b. NEW rules to add to the catalog (queued as Suggestion rows
 *            for Andre to approve in admin).
 *   3. Once approved, the new rule lives in DerivativeCostRule and step 1
 *      starts handling that productivity deterministically forever.
 *
 * Net effect: AI proposes once per new productivity. After Andre approves
 * 5-10 rules per division, IA-2 stops being called for most lines.
 */

// ============================================================
// Types
// ============================================================

/**
 * Discriminated union covering the formula shapes IA-2 + Cowork can ship.
 * Storage: persisted as JSONB in DerivativeCostRule.formula.
 */
export type DerivativeFormula =
  /**
   * "X units of Y per unit of trigger line".
   * Example: 0.025 boxes of fasteners per SF of Hardie siding.
   *   factor=0.025, materialId=<hardie-fastener-box>, uomIn='SF', uomOut='BX'
   */
  | {
      kind: 'qty_per_unit';
      factor: number;
      uomIn: string;   // expected UOM of the trigger line
      uomOut: string;  // UOM of the derivative line
      // unit cost of the derivative is read from materialIdRef on the rule
    }
  /**
   * "X% of direct cost (labor or material) of the trigger line".
   * Example: blade/sandpaper allowance = 2% of material cost.
   *   percent=2.0, basis='material'
   */
  | {
      kind: 'percent_of_direct';
      percent: number;
      basis: 'labor' | 'material' | 'subtotal';
    }
  /**
   * "$X per week of project duration".
   * Example: dumpster $650/week. Uses Project.durationWeeks (IA-1 set it).
   *   cents=65000
   */
  | {
      kind: 'fixed_per_week';
      cents: number;
    }
  /**
   * "X units per opening (door / window EA-counted line)".
   * Example: 2 tubes of caulk per window opening.
   *   perUnit=2, uomOut='EA'
   */
  | {
      kind: 'count_per_opening';
      perUnit: number;
      uomOut: string;
    }
  /**
   * Lump sum — site-cost fixed dollar amount once per project.
   * Example: final clean $1500 flat.
   */
  | {
      kind: 'lump_sum';
      cents: number;
    };

export type RuleRef = {
  id: string;
  triggerProductivityMatchCode: string | null;
  triggerDivisionId: string | null;
  name: string;
  costType: 'material' | 'labor' | 'site' | 'cleanup';
  formula: DerivativeFormula;
  materialIdRef: string | null;
  uomIn: string | null;
  uomOut: string | null;
  isActive: boolean;
};

export type RuleMaterialRef = {
  id: string;
  name: string;
  uom: string;
  avgCents: number;
  wastePercent: number;
};

export type EstimateLineForRules = {
  id: string;
  classificationId: string | null;
  name: string;
  externalId: string | null;
  scope: string;
  uom: string;
  quantity: number;
  productivityEntryId: string | null;
  productivityMatchCode: string | null;  // joined from ProductivityEntry
  productivityDivisionId: string | null; // joined from ProductivityEntry
  laborCostCents: number | null;
  materialCostCents: number | null;
  subtotalCents: number | null;
  source: string | null;
};

export type DerivativeProposal = {
  ruleId: string;
  ruleName: string;
  parentLineId: string;
  /** Proposed EstimateLine fields */
  name: string;
  scope: 'service' | 'service_and_material';
  uom: string;
  quantity: number;
  materialCostCents: number | null;
  laborCostCents: number | null;
  subtotalCents: number;
  materialBreakdown: Array<{
    materialId: string | null;
    name: string;
    qty: number;
    uom: string;
    unitCostCents: number;
    wastePercent: number;
    subtotalCents: number;
  }> | null;
  /** For audit trail */
  reason: string;
};

export type EngineInput = {
  rules: RuleRef[];
  materials: RuleMaterialRef[];
  lines: EstimateLineForRules[];
  /** From Project — needed for fixed_per_week formulas */
  durationWeeks: number | null;
};

export type EngineResult = {
  proposals: DerivativeProposal[];
  /** Productivities (by id) that didn't match any rule — IA-2 should run on these. */
  uncoveredProductivityIds: string[];
  /** Lines without a productivity at all (manual entries, unresolved) — IA-2
   *  doesn't run on these; Andre handles manually. */
  unresolvedLineIds: string[];
};

// ============================================================
// Engine
// ============================================================

export function runRulesEngine(input: EngineInput): EngineResult {
  const proposals: DerivativeProposal[] = [];
  const uncoveredProductivityIds = new Set<string>();
  const unresolvedLineIds: string[] = [];

  // Index rules for quick lookup
  const rulesByMatchCode = new Map<string, RuleRef[]>();
  const rulesByDivisionId = new Map<string, RuleRef[]>();
  const projectLevelRules: RuleRef[] = []; // rules with NO trigger — applied once per project

  for (const r of input.rules) {
    if (!r.isActive) continue;
    if (r.triggerProductivityMatchCode) {
      const code = r.triggerProductivityMatchCode.toUpperCase();
      const list = rulesByMatchCode.get(code) ?? [];
      list.push(r);
      rulesByMatchCode.set(code, list);
    } else if (r.triggerDivisionId) {
      const list = rulesByDivisionId.get(r.triggerDivisionId) ?? [];
      list.push(r);
      rulesByDivisionId.set(r.triggerDivisionId, list);
    } else {
      projectLevelRules.push(r);
    }
  }

  const materialById = new Map(input.materials.map((m) => [m.id, m]));

  // ---- Per-line rules (matchCode + divisionId) ----
  const seenProductivityIds = new Set<string>();

  for (const line of input.lines) {
    // Skip derivative lines themselves to avoid recursion
    if (line.source === 'ai-derivative') continue;

    if (!line.productivityEntryId) {
      unresolvedLineIds.push(line.id);
      continue;
    }
    seenProductivityIds.add(line.productivityEntryId);

    // Collect rules that apply: matchCode-specific first, then division-wide
    const applicableRules: RuleRef[] = [];
    if (line.productivityMatchCode) {
      const code = line.productivityMatchCode.toUpperCase();
      applicableRules.push(...(rulesByMatchCode.get(code) ?? []));
    }
    if (line.productivityDivisionId) {
      applicableRules.push(...(rulesByDivisionId.get(line.productivityDivisionId) ?? []));
    }

    if (applicableRules.length === 0) {
      uncoveredProductivityIds.add(line.productivityEntryId);
      continue;
    }

    for (const rule of applicableRules) {
      const proposal = evaluateRuleAgainstLine(rule, line, materialById);
      if (proposal) proposals.push(proposal);
    }
  }

  // ---- Project-level rules (no trigger) ----
  // These don't tie to a specific parent line; we attach them to the line
  // with the highest subtotal so they hang somewhere visible in the rollup.
  if (projectLevelRules.length > 0) {
    const heaviestLine = input.lines
      .filter((l) => l.source !== 'ai-derivative')
      .sort((a, b) => (b.subtotalCents ?? 0) - (a.subtotalCents ?? 0))[0];

    if (heaviestLine) {
      for (const rule of projectLevelRules) {
        const proposal = evaluateProjectRule(rule, heaviestLine, input);
        if (proposal) proposals.push(proposal);
      }
    }
  }

  return {
    proposals,
    uncoveredProductivityIds: Array.from(uncoveredProductivityIds),
    unresolvedLineIds,
  };
}

// ============================================================
// Per-formula evaluators
// ============================================================

function evaluateRuleAgainstLine(
  rule: RuleRef,
  line: EstimateLineForRules,
  materialById: Map<string, RuleMaterialRef>
): DerivativeProposal | null {
  const f = rule.formula;

  switch (f.kind) {
    case 'qty_per_unit': {
      // UOM gate — don't apply siding-fastener rule (uomIn=SF) to a LF line
      if (line.uom.toUpperCase() !== f.uomIn.toUpperCase()) return null;

      const mat = rule.materialIdRef ? materialById.get(rule.materialIdRef) : null;
      if (!mat) return null;

      const qty = round4(line.quantity * f.factor);
      const wasted = round4(qty * (1 + mat.wastePercent / 100));
      const subtotal = Math.round(wasted * mat.avgCents);

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        parentLineId: line.id,
        name: rule.name,
        scope: 'service_and_material',
        uom: f.uomOut,
        quantity: qty,
        materialCostCents: subtotal,
        laborCostCents: null,
        subtotalCents: subtotal,
        materialBreakdown: [
          {
            materialId: mat.id,
            name: mat.name,
            qty: wasted,
            uom: mat.uom,
            unitCostCents: mat.avgCents,
            wastePercent: mat.wastePercent,
            subtotalCents: subtotal,
          },
        ],
        reason: `qty_per_unit: ${f.factor} ${f.uomOut}/${f.uomIn} × ${line.quantity} ${line.uom} = ${qty} ${f.uomOut} (×${1 + mat.wastePercent / 100} waste).`,
      };
    }

    case 'percent_of_direct': {
      const basis =
        f.basis === 'labor'
          ? line.laborCostCents
          : f.basis === 'material'
            ? line.materialCostCents
            : line.subtotalCents;
      if (!basis || basis <= 0) return null;
      const subtotal = Math.round((basis * f.percent) / 100);
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        parentLineId: line.id,
        name: rule.name,
        scope: 'service',
        uom: 'EA',
        quantity: 1,
        materialCostCents: rule.costType === 'material' ? subtotal : null,
        laborCostCents: rule.costType === 'labor' || rule.costType === 'cleanup' ? subtotal : null,
        subtotalCents: subtotal,
        materialBreakdown: null,
        reason: `percent_of_direct: ${f.percent}% of ${f.basis} cost ($${(basis / 100).toFixed(2)}).`,
      };
    }

    case 'count_per_opening': {
      const mat = rule.materialIdRef ? materialById.get(rule.materialIdRef) : null;
      if (!mat) return null;
      const qty = round4(line.quantity * f.perUnit);
      const subtotal = Math.round(qty * mat.avgCents);
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        parentLineId: line.id,
        name: rule.name,
        scope: 'service_and_material',
        uom: f.uomOut,
        quantity: qty,
        materialCostCents: subtotal,
        laborCostCents: null,
        subtotalCents: subtotal,
        materialBreakdown: [
          {
            materialId: mat.id,
            name: mat.name,
            qty,
            uom: mat.uom,
            unitCostCents: mat.avgCents,
            wastePercent: 0,
            subtotalCents: subtotal,
          },
        ],
        reason: `count_per_opening: ${f.perUnit} × ${line.quantity} = ${qty}.`,
      };
    }

    // fixed_per_week and lump_sum are project-level — handled below.
    case 'fixed_per_week':
    case 'lump_sum':
      return null;
  }
}

function evaluateProjectRule(
  rule: RuleRef,
  attachTo: EstimateLineForRules,
  input: EngineInput
): DerivativeProposal | null {
  const f = rule.formula;

  if (f.kind === 'fixed_per_week') {
    const weeks = input.durationWeeks ?? 0;
    if (weeks <= 0) return null;
    const subtotal = f.cents * weeks;
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      parentLineId: attachTo.id,
      name: rule.name,
      scope: 'service',
      uom: 'WK',
      quantity: weeks,
      materialCostCents: rule.costType === 'material' ? subtotal : null,
      laborCostCents:
        rule.costType === 'labor' || rule.costType === 'cleanup' ? subtotal : null,
      subtotalCents: subtotal,
      materialBreakdown: null,
      reason: `fixed_per_week: $${(f.cents / 100).toFixed(2)}/wk × ${weeks} wk = $${(subtotal / 100).toFixed(2)}.`,
    };
  }

  if (f.kind === 'lump_sum') {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      parentLineId: attachTo.id,
      name: rule.name,
      scope: 'service',
      uom: 'LS',
      quantity: 1,
      materialCostCents: rule.costType === 'material' ? f.cents : null,
      laborCostCents:
        rule.costType === 'labor' || rule.costType === 'cleanup' ? f.cents : null,
      subtotalCents: f.cents,
      materialBreakdown: null,
      reason: `lump_sum: $${(f.cents / 100).toFixed(2)}.`,
    };
  }

  return null;
}

// ============================================================
// Helpers
// ============================================================

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
