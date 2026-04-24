/**
 * Auto-pricing engine — takes a Takeoff Classification plus reference
 * catalogs (productivity, labor rates, materials) and produces the
 * snapshot values that live on an EstimateLine.
 *
 * Pure functions, no Prisma calls. Callers load the reference data
 * once per estimate, then run `priceClassification` per line.
 */

import type { ClassificationScope, Uom } from '@/lib/takeoff-utils';

// ============================================================
// Types
// ============================================================

export type MhRangeMode = 'low' | 'avg' | 'high';
export type ShopType = 'open_shop' | 'union';

export type RefProductivity = {
  id: string;
  divisionId: string;
  scopeName: string;
  uom: string;
  crewDescription: string | null;
  assumedTradeId: string | null;
  mhPerUnitLow: number | null;
  mhPerUnitAvg: number;
  mhPerUnitHigh: number | null;
  matchCode: string | null;
  matchKeywords: string | null;
  notes: string | null;
};

export type RefLaborRate = {
  id: string;
  tradeId: string;
  regionId: string;
  shopType: string;
  lowCents: number | null;
  avgCents: number;
  highCents: number | null;
};

export type RefMaterial = {
  id: string;
  divisionId: string | null;
  name: string;
  uom: string;
  lowCents: number | null;
  avgCents: number;
  highCents: number | null;
  wastePercent: number;
};

export type PricingConfig = {
  regionId: string;
  shopType: ShopType;
  mhRangeMode: MhRangeMode;
};

/**
 * When a productivity entry doesn't specify an assumedTrade (most of
 * Andre's sheet doesn't), we fall back on a division-to-trade map.
 * This is a best-guess lookup; the user can override per line in the
 * estimate UI later.
 *
 * Key = normalized division name, Value = substring match against
 * LaborTrade.name (case-insensitive).
 */
const DIVISION_TO_TRADE_HINT: Record<string, string> = {
  'rough carpentry': 'carpenter — rough',
  'finish carpentry': 'carpenter — finish',
  'siding': 'siding installer',
  'avb / wrb': 'carpenter — rough',
  'windows': 'carpenter — finish',
  'drywall': 'drywall hanger',
  'insulation': 'insulation installer',
  'painting': 'painter',
  'tile': 'tile setter',
  'flooring': 'flooring installer',
  'cabinets': 'carpenter — finish',
  'roofing': 'roofing installer',
  'electrical': 'electrician',
  'plumbing': 'plumber',
  'hvac': 'hvac tech',
};

export type RefLaborTrade = {
  id: string;
  name: string;
  divisionId: string | null;
};

/**
 * Pick a LaborTrade id for a productivity entry that doesn't have
 * one. Tries the division-name hint first, falling back to any trade
 * that matches the division.
 */
export function resolveFallbackTrade(
  divisionName: string | null,
  trades: RefLaborTrade[]
): string | null {
  if (!divisionName) return null;
  const hint = DIVISION_TO_TRADE_HINT[divisionName.toLowerCase()];
  if (hint) {
    const match = trades.find((t) => t.name.toLowerCase() === hint);
    if (match) return match.id;
  }
  // Last resort: first trade whose name contains any division token.
  const divTokens = tokenize(divisionName);
  for (const t of trades) {
    const tradeTokens = tokenize(t.name);
    if ([...divTokens].some((tok) => tradeTokens.has(tok))) return t.id;
  }
  return null;
}

export type PricingInput = {
  name: string;
  externalId: string | null;
  scope: ClassificationScope | string;
  uom: string;
  quantity: number;
};

export type MaterialBreakdownItem = {
  materialId: string | null;
  name: string;
  qty: number;
  uom: string;
  unitCostCents: number;
  wastePercent: number;
  subtotalCents: number;
};

export type PricingResult = {
  // Matches
  productivityEntryId: string | null;
  laborTradeId: string | null;

  // Labor (all null if no productivity match)
  mhPerUnit: number | null;
  laborHours: number | null;
  laborRateCents: number | null;
  laborCostCents: number | null;

  // Material
  materialCostCents: number | null;
  materialBreakdown: MaterialBreakdownItem[] | null;

  // Meta
  suggestedByAi: boolean;
  aiConfidence: number;          // 0-100
  needsReview: boolean;
  notes: string[];               // warnings for the UI
};

// ============================================================
// Range pickers
// ============================================================

function pickMh(p: RefProductivity, mode: MhRangeMode): number {
  if (mode === 'low') return Number(p.mhPerUnitLow ?? p.mhPerUnitAvg);
  if (mode === 'high') return Number(p.mhPerUnitHigh ?? p.mhPerUnitAvg);
  return Number(p.mhPerUnitAvg);
}

function pickRate(r: RefLaborRate, mode: MhRangeMode): number {
  if (mode === 'low') return r.lowCents ?? r.avgCents;
  if (mode === 'high') return r.highCents ?? r.avgCents;
  return r.avgCents;
}

function pickMaterial(m: RefMaterial, mode: MhRangeMode): number {
  if (mode === 'low') return m.lowCents ?? m.avgCents;
  if (mode === 'high') return m.highCents ?? m.avgCents;
  return m.avgCents;
}

// ============================================================
// Matching helpers
// ============================================================

const STOPWORDS = new Set([
  'and',
  'the',
  'with',
  'for',
  'of',
  'to',
  'at',
  'on',
  'in',
  'or',
  'per',
  'incl',
  'including',
  'typical',
  'standard',
  'by',
  'not',
  'a',
  'an',
  'this',
  'that',
  'size',
]);

/**
 * Naive stemmer — strips a trailing "s" on words ≥ 5 chars and a
 * trailing "es" on words ≥ 6 chars so "windows" and "window" both
 * land on "window". Good enough for carpentry nomenclature; we can
 * upgrade to a real stemmer if matches start getting flaky.
 */
function stem(t: string): string {
  if (t.length >= 6 && t.endsWith('es')) return t.slice(0, -2);
  if (t.length >= 5 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

function tokenize(s: string): Set<string> {
  const tokens = s
    .toLowerCase()
    .replace(/["'()\[\]{}]/g, ' ')
    .replace(/[^a-z0-9\s\-\/]/g, ' ')
    .split(/[\s\-\/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map(stem);
  return new Set(tokens);
}

/**
 * Containment score. When one string is much shorter than the other
 * (a 2-token classification name vs. a 10-token scope description),
 * Jaccard punishes the pair too hard. Containment — "how many tokens
 * of the smaller set appear in the bigger set" — is a better fit for
 * auto-match use. Returns 0..1.
 */
function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  const minSize = Math.min(a.size, b.size);
  return minSize === 0 ? 0 : intersect / minSize;
}

export type ProductivityMatch = {
  entry: RefProductivity;
  score: number;            // 0..1
  by: 'match_code' | 'keywords' | 'fallback';
};

export function findBestProductivity(
  input: PricingInput,
  rows: RefProductivity[]
): ProductivityMatch | null {
  // 1. Exact externalId → matchCode hit (case-insensitive)
  if (input.externalId) {
    const code = input.externalId.toLowerCase().trim();
    const exact = rows.find(
      (r) => r.matchCode && r.matchCode.toLowerCase() === code
    );
    if (exact) return { entry: exact, score: 1, by: 'match_code' };
  }

  // 2. Fuzzy on scopeName / matchKeywords vs input.name
  const inputTokens = tokenize(input.name);
  if (inputTokens.size === 0) return null;

  let best: ProductivityMatch | null = null;
  for (const row of rows) {
    const rowTokens = tokenize(row.matchKeywords ?? row.scopeName);
    const score = containment(inputTokens, rowTokens);
    if (score > (best?.score ?? 0)) {
      best = { entry: row, score, by: 'keywords' };
    }
  }

  // Threshold — below this the match is too weak to trust. With the
  // containment metric this means "at least half of the smaller
  // token set overlapped" — typically enough signal for carpentry
  // scopes where the input name is 2-3 words and the scope is 8+.
  if (best && best.score >= 0.5) return best;
  return null;
}

export type MaterialMatch = {
  material: RefMaterial;
  score: number;
};

export function findBestMaterial(
  input: PricingInput,
  rows: RefMaterial[],
  // If we know the productivity match, prefer materials in the same division
  preferDivisionId: string | null
): MaterialMatch | null {
  const inputTokens = tokenize(input.name);
  if (inputTokens.size === 0) return null;

  let best: MaterialMatch | null = null;
  for (const row of rows) {
    let score = containment(inputTokens, tokenize(row.name));
    // Bonus if the material sits in the productivity's division
    if (preferDivisionId && row.divisionId === preferDivisionId) {
      score += 0.05;
    }
    // Bonus if UOMs match
    if (row.uom.toLowerCase() === input.uom.toLowerCase()) {
      score += 0.05;
    }
    if (score > (best?.score ?? 0)) {
      best = { material: row, score };
    }
  }

  // Materials need a tighter threshold than productivity because the
  // catalog is bigger and false matches are costlier.
  if (best && best.score >= 0.6) return best;
  return null;
}

// ============================================================
// Confidence
// ============================================================

function buildConfidence(opts: {
  productivityScore: number;       // 0..1 from Jaccard
  matchedByCode: boolean;
  hasTradeResolved: boolean;
  hasRate: boolean;
  needsMaterial: boolean;
  materialMatched: boolean;
}): number {
  let c = Math.round(opts.productivityScore * 60); // 0..60 from match quality
  if (opts.matchedByCode) c += 15;                 // exact code = big boost
  if (opts.hasTradeResolved && opts.hasRate) c += 10;
  if (opts.needsMaterial) {
    if (opts.materialMatched) c += 15;
    // else: don't subtract — score already reflects lack of material via needsReview
  } else {
    // Service-only — material irrelevant
    c += 10;
  }
  return Math.max(0, Math.min(100, c));
}

// ============================================================
// Main
// ============================================================

export function priceClassification(
  input: PricingInput,
  config: PricingConfig,
  refs: {
    productivity: RefProductivity[];
    laborRates: RefLaborRate[];
    materials: RefMaterial[];
    /** Division id → fallback trade id for productivity rows without assumedTradeId. */
    fallbackTradeByDivisionId?: Map<string, string>;
  }
): PricingResult {
  const notes: string[] = [];

  const prod = findBestProductivity(input, refs.productivity);

  if (!prod) {
    notes.push('No productivity match — fill labor manually.');
    return {
      productivityEntryId: null,
      laborTradeId: null,
      mhPerUnit: null,
      laborHours: null,
      laborRateCents: null,
      laborCostCents: null,
      materialCostCents: null,
      materialBreakdown: null,
      suggestedByAi: false,
      aiConfidence: 0,
      needsReview: true,
      notes,
    };
  }

  // --- Labor ---
  const tradeId =
    prod.entry.assumedTradeId ??
    refs.fallbackTradeByDivisionId?.get(prod.entry.divisionId) ??
    null;
  const mh = pickMh(prod.entry, config.mhRangeMode);
  const laborHours = Math.round(input.quantity * mh * 1000) / 1000;

  let laborRateCents: number | null = null;
  if (tradeId) {
    const rate = refs.laborRates.find(
      (r) =>
        r.tradeId === tradeId &&
        r.regionId === config.regionId &&
        r.shopType === config.shopType
    );
    if (rate) {
      laborRateCents = pickRate(rate, config.mhRangeMode);
    } else {
      notes.push(
        `No ${config.shopType} rate for trade in this region — defaulted to 0.`
      );
    }
  } else {
    notes.push('No assumed trade on productivity entry — pick one to price labor.');
  }

  const laborCostCents =
    laborRateCents !== null ? Math.round(laborHours * laborRateCents) : null;

  // --- Material (only if scope implies material) ---
  let materialCostCents: number | null = null;
  let materialBreakdown: MaterialBreakdownItem[] | null = null;
  const needsMaterial = input.scope === 'service_and_material';
  let materialMatched = false;

  if (needsMaterial) {
    const mat = findBestMaterial(input, refs.materials, prod.entry.divisionId);
    if (mat) {
      const unit = pickMaterial(mat.material, config.mhRangeMode);
      const wastePct = mat.material.wastePercent;
      const wastedQty = Math.round(input.quantity * (1 + wastePct / 100) * 10000) / 10000;
      const subtotal = Math.round(wastedQty * unit);
      materialBreakdown = [
        {
          materialId: mat.material.id,
          name: mat.material.name,
          qty: wastedQty,
          uom: mat.material.uom,
          unitCostCents: unit,
          wastePercent: wastePct,
          subtotalCents: subtotal,
        },
      ];
      materialCostCents = subtotal;
      materialMatched = true;
    } else {
      notes.push('No material match — add materials manually.');
    }
  }

  const confidence = buildConfidence({
    productivityScore: prod.score,
    matchedByCode: prod.by === 'match_code',
    hasTradeResolved: !!tradeId,
    hasRate: laborRateCents !== null,
    needsMaterial,
    materialMatched,
  });

  const needsReview =
    confidence < 70 ||
    laborRateCents === null ||
    (needsMaterial && !materialMatched);

  return {
    productivityEntryId: prod.entry.id,
    laborTradeId: tradeId,
    mhPerUnit: mh,
    laborHours,
    laborRateCents,
    laborCostCents,
    materialCostCents,
    materialBreakdown,
    suggestedByAi: true,
    aiConfidence: confidence,
    needsReview,
    notes,
  };
}

// ============================================================
// Cost factor application (on the estimate totals)
// ============================================================

export type AppliedFactor = {
  appliesTo: 'labor' | 'material' | 'overhead';
  impactPercent: number; // 0.15 for 15%
};

export type EstimateTotals = {
  laborCostCents: number;
  materialCostCents: number;
  laborFactoredCents: number;
  materialFactoredCents: number;
  overheadCents: number;
  markupCents: number;
  contingencyCents: number;
  salesTaxCents: number;
  totalCents: number;
};

/**
 * Rolls the line-level labor + material subtotals into an estimate total,
 * applying cost factors and margin percentages in the expected order:
 *   1. Sum labor + material across lines
 *   2. Apply labor-scoped factors + material-scoped factors
 *   3. Overhead % on (labor + material after factors)
 *   4. Apply overhead-scoped factors
 *   5. Contingency % on subtotal so far
 *   6. Markup % on subtotal so far
 *   7. Sales tax % on subtotal so far
 */
export function rollupTotals(
  lines: Array<{ laborCostCents: number | null; materialCostCents: number | null }>,
  factors: AppliedFactor[],
  margins: {
    markupPercent: number | null;
    overheadPercent: number | null;
    contingencyPercent: number | null;
    salesTaxPercent: number | null;
  }
): EstimateTotals {
  const labor = lines.reduce((s, l) => s + (l.laborCostCents ?? 0), 0);
  const material = lines.reduce((s, l) => s + (l.materialCostCents ?? 0), 0);

  const laborFactor = factors
    .filter((f) => f.appliesTo === 'labor')
    .reduce((s, f) => s + Number(f.impactPercent), 0);
  const materialFactor = factors
    .filter((f) => f.appliesTo === 'material')
    .reduce((s, f) => s + Number(f.impactPercent), 0);
  const overheadFactor = factors
    .filter((f) => f.appliesTo === 'overhead')
    .reduce((s, f) => s + Number(f.impactPercent), 0);

  const laborFactored = Math.round(labor * (1 + laborFactor));
  const materialFactored = Math.round(material * (1 + materialFactor));
  const hardCost = laborFactored + materialFactored;

  const overheadBase = (margins.overheadPercent ?? 0) / 100;
  const overhead = Math.round(hardCost * overheadBase * (1 + overheadFactor));
  const afterOverhead = hardCost + overhead;

  const contingency = Math.round(
    afterOverhead * ((margins.contingencyPercent ?? 0) / 100)
  );
  const afterContingency = afterOverhead + contingency;

  const markup = Math.round(
    afterContingency * ((margins.markupPercent ?? 0) / 100)
  );
  const afterMarkup = afterContingency + markup;

  const salesTax = Math.round(
    afterMarkup * ((margins.salesTaxPercent ?? 0) / 100)
  );
  const total = afterMarkup + salesTax;

  return {
    laborCostCents: labor,
    materialCostCents: material,
    laborFactoredCents: laborFactored,
    materialFactoredCents: materialFactored,
    overheadCents: overhead,
    markupCents: markup,
    contingencyCents: contingency,
    salesTaxCents: salesTax,
    totalCents: total,
  };
}
