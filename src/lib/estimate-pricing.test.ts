import { describe, it, expect } from 'vitest';
import {
  sectionForDivision,
  resolveFallbackTrade,
  findBestProductivity,
  findBestMaterial,
  priceClassification,
  priceWithProductivity,
  rollupTotals,
  type RefLaborTrade,
  type RefProductivity,
  type RefLaborRate,
  type RefMaterial,
  type PricingInput,
  type PricingConfig,
  type AppliedFactor,
} from '@/lib/estimate-pricing';

// =============================================================================
// sectionForDivision
//
// The function lowercases + trims the input, then looks it up in the
// DIVISION_TO_SECTION map. Misses fall back to the original input string.
// Null/undefined/empty inputs short-circuit to "Other".
// =============================================================================
describe('sectionForDivision', () => {
  it('maps known divisions to their canonical section label', () => {
    // Pairs taken directly from DIVISION_TO_SECTION in estimate-pricing.ts.
    // Note that some keys differ from their values (e.g. siding → "Siding
    // & Cladding"), so this is a real lookup, not a passthrough.
    expect(sectionForDivision('Siding')).toBe('Siding & Cladding');
    expect(sectionForDivision('Rough Carpentry')).toBe('Rough Framing');
    expect(sectionForDivision('Finish Carpentry')).toBe('Trim & Finish Carpentry');
    expect(sectionForDivision('AVB / WRB')).toBe('Air & Water Barriers');
    expect(sectionForDivision('Roofing')).toBe('Roofing');
  });

  it('matches division names case-insensitively', () => {
    expect(sectionForDivision('SIDING')).toBe('Siding & Cladding');
    expect(sectionForDivision('siding')).toBe('Siding & Cladding');
    expect(sectionForDivision('Siding')).toBe('Siding & Cladding');
  });

  it('trims surrounding whitespace before the lookup', () => {
    expect(sectionForDivision('  Siding  ')).toBe('Siding & Cladding');
  });

  it('returns the input name unchanged when not in the map', () => {
    expect(sectionForDivision('Custom Division Name')).toBe('Custom Division Name');
  });

  it('returns "Other" when divisionName is null', () => {
    expect(sectionForDivision(null)).toBe('Other');
  });

  it('returns "Other" when divisionName is undefined', () => {
    expect(sectionForDivision(undefined)).toBe('Other');
  });

  it('returns "Other" when divisionName is an empty string', () => {
    // Empty string is falsy, so the early-return guard catches it.
    expect(sectionForDivision('')).toBe('Other');
  });

  it('returns the original whitespace-only string unchanged', () => {
    // Documents current behavior: whitespace-only input is truthy (skips
    // the null guard), gets trimmed to '' for the lookup (which misses),
    // then falls back to the unchanged original. Revisit if this becomes
    // a UX problem — the consumer renders this string verbatim.
    expect(sectionForDivision('   ')).toBe('   ');
  });
});

// =============================================================================
// resolveFallbackTrade
//
// Two-stage lookup:
//   1. DIVISION_TO_TRADE_HINT[lowercased divisionName] → trade.name lowercase
//      EXACT equality (not substring). Important: the hint values use an
//      em-dash (U+2014) for compound names like 'carpenter — rough', so a
//      trade named "Carpenter Rough" with a regular space WILL NOT match
//      the hint and falls through to step 2.
//   2. Token-overlap fallback: tokenize divisionName + each trade.name,
//      return the first trade with at least one shared token.
// =============================================================================
describe('resolveFallbackTrade', () => {
  // Reusable trade fixtures. Names are chosen to exercise both branches:
  // - 'Siding Installer' lowercase exactly matches the 'siding' hint
  // - 'Carpenter Rough' (regular space) shares the token 'rough' with
  //   the division 'Rough Framing' for the fallback path
  const trades: RefLaborTrade[] = [
    { id: 'trade-1', name: 'Siding Installer', divisionId: null },
    { id: 'trade-2', name: 'Carpenter Rough', divisionId: null },
    { id: 'trade-3', name: 'Roofer', divisionId: null },
    { id: 'trade-4', name: 'General Laborer', divisionId: null },
  ];

  it('returns the trade id when division matches a hint and trade name aligns', () => {
    // 'siding' → 'siding installer' hint, and 'Siding Installer'.toLowerCase()
    // equals that hint exactly → direct match.
    expect(resolveFallbackTrade('Siding', trades)).toBe('trade-1');
  });

  it('matches case-insensitively on the division name for the hint lookup', () => {
    expect(resolveFallbackTrade('SIDING', trades)).toBe('trade-1');
    expect(resolveFallbackTrade('siding', trades)).toBe('trade-1');
  });

  it('falls through to token overlap when hint exists but no trade name matches it exactly', () => {
    // 'rough carpentry' → 'carpenter — rough' (em-dash). None of our trade
    // names match that exactly (we have 'Carpenter Rough' with space).
    // Falls through to tokenize: {rough, carpentry} ∩ {carpenter, rough}
    // = {rough} → first matching trade returned.
    expect(resolveFallbackTrade('Rough Carpentry', trades)).toBe('trade-2');
  });

  it('matches division to trade name via token overlap when there is no hint at all', () => {
    // 'Rough Framing' is NOT a key in DIVISION_TO_TRADE_HINT (only
    // 'rough carpentry' is). Tokenized: {rough, framing}. Overlaps with
    // 'Carpenter Rough' on 'rough' → returns trade-2.
    expect(resolveFallbackTrade('Rough Framing', trades)).toBe('trade-2');
  });

  it('returns null when division name has no hint and no token overlap with any trade', () => {
    expect(resolveFallbackTrade('Underwater Welding', trades)).toBeNull();
  });

  it('returns null when divisionName is null', () => {
    expect(resolveFallbackTrade(null, trades)).toBeNull();
  });

  it('returns null when trades array is empty', () => {
    // Even though 'siding' has a hint, an empty trades array can't satisfy
    // either the direct find() or the token-overlap loop. Both return null.
    expect(resolveFallbackTrade('Siding', [])).toBeNull();
  });
});

// =============================================================================
// findBestProductivity
//
// Two-level matcher:
//   L1: input.externalId (lowercased+trimmed) === row.matchCode (lowercased)
//       → score 1, by='match_code', short-circuits L2.
//   L2: tokenize(input.name) vs tokenize(row.matchKeywords ?? row.scopeName),
//       containment metric, threshold >= 0.5, by='keywords'.
// =============================================================================

// Reusable productivity catalog. Numeric fields (mhPerUnit*) don't matter
// for matcher tests — they're consumed by priceClassification later.
const baseProd = {
  divisionId: 'div-x',
  uom: 'sf',
  crewDescription: null,
  assumedTradeId: null,
  mhPerUnitLow: null,
  mhPerUnitHigh: null,
  notes: null,
};

const prodCatalog: RefProductivity[] = [
  // p1: clear matchCode SDFC + siding-themed keywords
  {
    ...baseProd,
    id: 'p1',
    divisionId: 'div-siding',
    scopeName: 'Install fiber cement siding panels',
    matchCode: 'SDFC',
    matchKeywords: 'fiber cement siding panel install',
    mhPerUnitAvg: 0.06,
  },
  // p2: framing — distinct keyword set so 'frame'/'wall' inputs route here
  {
    ...baseProd,
    id: 'p2',
    divisionId: 'div-rough',
    scopeName: 'Frame exterior wall 2x6',
    matchCode: 'RCFRMW',
    matchKeywords: 'frame exterior wall rough framing stud',
    mhPerUnitAvg: 0.045,
  },
  // p3: roofing TPO
  {
    ...baseProd,
    id: 'p3',
    divisionId: 'div-roof',
    scopeName: 'Install TPO roofing membrane',
    matchCode: 'RFTPO',
    matchKeywords: 'tpo roofing membrane install',
    mhPerUnitAvg: 0.03,
  },
  // p4: null matchCode — exercises the L1 guard `r.matchCode &&`
  {
    ...baseProd,
    id: 'p4',
    divisionId: 'div-paint',
    scopeName: 'Paint interior walls latex',
    matchCode: null,
    matchKeywords: 'paint interior wall latex coating',
    mhPerUnitAvg: 0.02,
  },
];

const baseInput: PricingInput = {
  externalId: null,
  name: 'placeholder',
  uom: 'sf',
  quantity: 100,
  scope: 'service_and_material',
};

describe('findBestProductivity', () => {
  describe('Level 1 — exact matchCode hit', () => {
    it('returns score 1 and by=match_code on exact externalId hit', () => {
      const result = findBestProductivity(
        { ...baseInput, externalId: 'SDFC', name: 'something completely different' },
        prodCatalog,
      );
      expect(result).not.toBeNull();
      expect(result?.score).toBe(1);
      expect(result?.by).toBe('match_code');
      expect(result?.entry.id).toBe('p1');
    });

    it('matches matchCode case-insensitively on the input side', () => {
      const result = findBestProductivity(
        { ...baseInput, externalId: 'sdfc', name: 'irrelevant' },
        prodCatalog,
      );
      expect(result?.by).toBe('match_code');
      expect(result?.entry.id).toBe('p1');
    });

    it('trims whitespace on the input externalId before comparing', () => {
      // Input gets `.toLowerCase().trim()`. matchCode itself is NOT trimmed
      // server-side — see the dedicated test below for that asymmetry.
      const result = findBestProductivity(
        { ...baseInput, externalId: '  SDFC  ', name: 'irrelevant' },
        prodCatalog,
      );
      expect(result?.entry.id).toBe('p1');
      expect(result?.by).toBe('match_code');
    });

    it('short-circuits L1 over a higher fuzzy match that would also hit', () => {
      // externalId locks p1 even though name overlaps strongly with p2.
      // No L2 evaluation runs — the function returns immediately.
      const result = findBestProductivity(
        {
          ...baseInput,
          externalId: 'SDFC',
          name: 'frame exterior wall stud rough framing',
        },
        prodCatalog,
      );
      expect(result?.entry.id).toBe('p1');
      expect(result?.by).toBe('match_code');
      expect(result?.score).toBe(1);
    });

    it('falls through to fuzzy when externalId does not match any row', () => {
      const result = findBestProductivity(
        {
          ...baseInput,
          externalId: 'NONEXISTENT',
          name: 'install fiber cement siding',
        },
        prodCatalog,
      );
      expect(result?.by).toBe('keywords');
      expect(result?.entry.id).toBe('p1');
    });

    it('skips L1 when externalId is null', () => {
      const result = findBestProductivity(
        { ...baseInput, externalId: null, name: 'install fiber cement siding' },
        prodCatalog,
      );
      expect(result?.by).toBe('keywords');
    });

    it('skips L1 when externalId is empty string (falsy)', () => {
      const result = findBestProductivity(
        { ...baseInput, externalId: '', name: 'install fiber cement siding' },
        prodCatalog,
      );
      expect(result?.by).toBe('keywords');
    });

    it('ignores rows with null matchCode at the L1 stage (no exception)', () => {
      // p4 has matchCode=null. The `r.matchCode &&` guard skips it cleanly.
      // Searching for a code that only matches the null row returns no L1 hit.
      const result = findBestProductivity(
        { ...baseInput, externalId: 'WHATEVER', name: 'paint interior wall latex' },
        prodCatalog,
      );
      // Cascades to fuzzy and matches p4 by keywords
      expect(result?.entry.id).toBe('p4');
      expect(result?.by).toBe('keywords');
    });
  });

  describe('Level 2 — fuzzy keyword match', () => {
    it('matches via keywords when no externalId provided', () => {
      const result = findBestProductivity(
        { ...baseInput, name: 'fiber cement siding installation' },
        prodCatalog,
      );
      expect(result?.by).toBe('keywords');
      expect(result?.entry.id).toBe('p1');
      expect(result?.score).toBeGreaterThanOrEqual(0.5);
      expect(result?.score).toBeLessThanOrEqual(1);
    });

    it('returns null when fuzzy score is below 0.5 threshold', () => {
      const result = findBestProductivity(
        { ...baseInput, name: 'underwater scuba diving equipment' },
        prodCatalog,
      );
      expect(result).toBeNull();
    });

    it('picks the highest-scoring row when multiple pass the threshold', () => {
      // Input tokens: {install, roofing, siding, cement}
      // vs p1 keywords {install, fiber, cement, siding, panel}
      //   overlap = {install, siding, cement} = 3, min(4,5)=4 → 0.75
      // vs p3 keywords {tpo, roofing, membrane, install}
      //   overlap = {install, roofing} = 2, min(4,4)=4 → 0.50  (right at threshold)
      // p1 (0.75) wins.
      const result = findBestProductivity(
        { ...baseInput, name: 'install roofing siding cement' },
        prodCatalog,
      );
      expect(result?.entry.id).toBe('p1');
      expect(result?.by).toBe('keywords');
    });

    it('falls back to scopeName when matchKeywords is null', () => {
      // Synthesize a row with null matchKeywords so the function falls
      // through to scopeName tokenization for fuzzy matching.
      const sparseCatalog: RefProductivity[] = [
        {
          ...baseProd,
          id: 'sparse',
          divisionId: 'div-x',
          scopeName: 'Hang gypsum drywall sheets',
          matchCode: null,
          matchKeywords: null,
          mhPerUnitAvg: 0.04,
        },
      ];
      const result = findBestProductivity(
        { ...baseInput, name: 'hang drywall sheets' },
        sparseCatalog,
      );
      expect(result?.entry.id).toBe('sparse');
      expect(result?.by).toBe('keywords');
    });
  });

  describe('Edge cases', () => {
    it('returns null when catalog is empty', () => {
      const result = findBestProductivity(
        { ...baseInput, externalId: 'SDFC', name: 'fiber cement' },
        [],
      );
      expect(result).toBeNull();
    });

    it('returns null when input name has only stopwords', () => {
      // tokenize() filters STOPWORDS → empty Set → early return after L1 misses
      const result = findBestProductivity(
        { ...baseInput, name: 'the and of at on in' },
        prodCatalog,
      );
      expect(result).toBeNull();
    });

    it('returns null when input name has only short tokens (< 3 chars)', () => {
      // tokenize() filter requires length >= 3
      const result = findBestProductivity({ ...baseInput, name: 'a b c d' }, prodCatalog);
      expect(result).toBeNull();
    });
  });
});

// =============================================================================
// findBestMaterial
//
// Same matcher core as findBestProductivity, with two extra rules:
//   - HARD UOM lock: rows whose UOM isn't compatible with input.uom are
//     skipped entirely (uomCompatible — accepts identical, FT↔LF, SF↔SY,
//     SF↔SQ; trim+upper-case both sides before comparing).
//   - +0.05 division bonus when row.divisionId matches preferDivisionId.
//   - Tighter threshold: >= 0.6 (vs 0.5 on productivity).
// Return shape is `{ material, score }` — no `by` discriminator.
// =============================================================================

const matCatalog: RefMaterial[] = [
  {
    id: 'm1',
    divisionId: 'div-siding',
    name: 'Hardie cement siding plank',
    uom: 'sf',
    lowCents: null,
    avgCents: 250,
    highCents: null,
    wastePercent: 10,
  },
  {
    id: 'm2',
    divisionId: 'div-trim',
    name: 'Aluminum corner trim',
    uom: 'lf',
    lowCents: null,
    avgCents: 320,
    highCents: null,
    wastePercent: 5,
  },
  {
    id: 'm3',
    divisionId: 'div-roof',
    name: 'TPO membrane roofing',
    uom: 'sf',
    lowCents: null,
    avgCents: 180,
    highCents: null,
    wastePercent: 8,
  },
  {
    id: 'm4',
    divisionId: null,
    name: 'Carpet flooring',
    uom: 'sy',
    lowCents: null,
    avgCents: 4500,
    highCents: null,
    wastePercent: 10,
  },
  {
    id: 'm5',
    divisionId: 'div-roof',
    name: 'Asphalt shingle bundle',
    uom: 'sq',
    lowCents: null,
    avgCents: 12000,
    highCents: null,
    wastePercent: 12,
  },
  // m6/m7 share name+uom; only divisionId differs — used to test the bonus
  {
    id: 'm6',
    divisionId: 'div-siding',
    name: 'Generic insulation board',
    uom: 'sf',
    lowCents: null,
    avgCents: 400,
    highCents: null,
    wastePercent: 5,
  },
  {
    id: 'm7',
    divisionId: 'div-other',
    name: 'Generic insulation board',
    uom: 'sf',
    lowCents: null,
    avgCents: 400,
    highCents: null,
    wastePercent: 5,
  },
];

describe('findBestMaterial', () => {
  describe('UOM compatibility (hard lock)', () => {
    it('matches when input UOM and material UOM are identical (SF=SF)', () => {
      const result = findBestMaterial(
        { ...baseInput, name: 'hardie cement siding', uom: 'sf' },
        matCatalog,
        null,
      );
      expect(result?.material.id).toBe('m1');
    });

    it('accepts FT and LF as compatible (linear synonyms)', () => {
      const result = findBestMaterial(
        { ...baseInput, name: 'aluminum corner trim', uom: 'ft' },
        matCatalog,
        null,
      );
      expect(result?.material.id).toBe('m2');
      expect(result?.material.uom).toBe('lf');
    });

    it('accepts SF and SY as compatible (area synonyms)', () => {
      const result = findBestMaterial(
        { ...baseInput, name: 'carpet flooring', uom: 'sf' },
        matCatalog,
        null,
      );
      expect(result?.material.id).toBe('m4');
      expect(result?.material.uom).toBe('sy');
    });

    it('accepts SF and SQ as compatible (area synonyms)', () => {
      const result = findBestMaterial(
        { ...baseInput, name: 'asphalt shingle bundle', uom: 'sf' },
        matCatalog,
        null,
      );
      expect(result?.material.id).toBe('m5');
      expect(result?.material.uom).toBe('sq');
    });

    it('rejects incompatible UOM pair (SF vs LF skips that row)', () => {
      // Input matches m2's name perfectly, but uom=sf and m2.uom=lf are
      // not compatible. m2 gets skipped, no other row matches → null.
      const result = findBestMaterial(
        { ...baseInput, name: 'aluminum corner trim', uom: 'sf' },
        matCatalog,
        null,
      );
      expect(result).toBeNull();
    });

    it('is case- and whitespace-insensitive on UOM normalization', () => {
      const result = findBestMaterial(
        { ...baseInput, name: 'carpet flooring', uom: '  SF  ' },
        matCatalog,
        null,
      );
      expect(result?.material.id).toBe('m4');
    });
  });

  describe('Threshold and scoring', () => {
    it('returns a match when score reaches the 0.6 threshold', () => {
      // Input tokens: {hardie, cement, siding}. m1 tokens: {hardie, cement,
      // siding, plank}. Overlap = 3, min(3,4)=3 → containment 1.0 ≥ 0.6.
      const result = findBestMaterial(
        { ...baseInput, name: 'hardie cement siding', uom: 'sf' },
        matCatalog,
        null,
      );
      expect(result).not.toBeNull();
      expect(result?.score).toBeGreaterThanOrEqual(0.6);
    });

    it('returns null when score is below the 0.6 threshold', () => {
      // Input 'cement panel' tokens {cement, panel}. vs m1 {hardie, cement,
      // siding, plank}. Overlap = {cement} = 1, min(2,4)=2 → 0.5 < 0.6.
      // (No other row scores higher, no division bonus since prefer=null.)
      const result = findBestMaterial(
        { ...baseInput, name: 'cement panel', uom: 'sf' },
        matCatalog,
        null,
      );
      expect(result).toBeNull();
    });

    it('applies +0.05 division bonus to push the matching-division row past tied competitors', () => {
      // m6 and m7 are identical except divisionId. Input tokens overlap
      // both equally → tied at 1.0 base score. preferDivisionId='div-siding'
      // grants +0.05 to m6 only → m6 wins.
      const result = findBestMaterial(
        { ...baseInput, name: 'generic insulation board', uom: 'sf' },
        matCatalog,
        'div-siding',
      );
      expect(result?.material.id).toBe('m6');
    });

    it('does not promote a low-score row by bonus alone (0 + 0.05 < 0.6)', () => {
      // Input has zero overlap with everything. Even with the bonus, the
      // best score is at most 0.05 — well below threshold.
      const result = findBestMaterial(
        { ...baseInput, name: 'completely unrelated terms here', uom: 'sf' },
        matCatalog,
        'div-siding',
      );
      expect(result).toBeNull();
    });

    it('does not apply bonus when preferDivisionId is null', () => {
      // Without a preferred division, m6 and m7 tie at 1.0 base. The first
      // row encountered in iteration order wins because score must be
      // strictly greater (linha 369: `score > best.score`). Fixture order
      // means m6 is found first → m6 wins. Documents iteration sensitivity.
      const result = findBestMaterial(
        { ...baseInput, name: 'generic insulation board', uom: 'sf' },
        matCatalog,
        null,
      );
      expect(result?.material.id).toBe('m6');
    });
  });

  describe('Edge cases', () => {
    it('returns null when catalog is empty', () => {
      const result = findBestMaterial(
        { ...baseInput, name: 'hardie cement siding', uom: 'sf' },
        [],
        null,
      );
      expect(result).toBeNull();
    });

    it('returns null when input name has empty token set', () => {
      // 'the of at' → all stopwords filtered → empty Set → early return.
      const result = findBestMaterial(
        { ...baseInput, name: 'the of at', uom: 'sf' },
        matCatalog,
        null,
      );
      expect(result).toBeNull();
    });

    it('return shape is { material, score } without a "by" field', () => {
      // Documents the asymmetry with ProductivityMatch (which has 'by').
      const result = findBestMaterial(
        { ...baseInput, name: 'hardie cement siding', uom: 'sf' },
        matCatalog,
        null,
      );
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('material');
      expect(result).toHaveProperty('score');
      expect(result).not.toHaveProperty('by');
    });
  });
});

// =============================================================================
// priceClassification & priceWithProductivity — shared fixtures
//
// These two functions both rely on labor rates, trades, and a fallback map.
// We define them once and reuse across both describe blocks.
//
// Rate distinct values (low/avg/high) prove that mhRangeMode actually flows
// through to pickRate / pickMh / pickMaterial.
// =============================================================================

const baseConfig: PricingConfig = {
  regionId: 'reg-ma-boston',
  shopType: 'open_shop',
  mhRangeMode: 'avg',
};

// Distinct low/avg/high so range-mode tests can assert which one was picked.
// trade-1 has rate row; trade-2 has none (exercises the "no rate found in
// this region" branch). We don't need a RefLaborTrade[] fixture here because
// priceClassification consumes the fallback map directly via divisionId.
const laborRates: RefLaborRate[] = [
  {
    id: 'rate-1',
    tradeId: 'trade-1',
    regionId: 'reg-ma-boston',
    shopType: 'open_shop',
    lowCents: 6000,
    avgCents: 7000,
    highCents: 8000,
  },
  {
    id: 'rate-3',
    tradeId: 'trade-3',
    regionId: 'reg-ma-boston',
    shopType: 'open_shop',
    lowCents: 5000,
    avgCents: 5500,
    highCents: 6000,
  },
];

// p1 already has assumedTradeId=null in the existing fixture. Build a map
// keyed by divisionId → tradeId so the fallback path can route to a trade.
const fallbackByDiv = new Map<string, string>([
  ['div-siding', 'trade-1'],
  ['div-rough', 'trade-2'],
  ['div-paint', 'trade-3'],
]);

const baseRefs = {
  productivity: prodCatalog,
  laborRates,
  materials: matCatalog,
  fallbackTradeByDivisionId: fallbackByDiv,
};

// =============================================================================
// priceClassification
//
// Pipeline:
//   1. findBestProductivity → if no match: minimal needsReview result + early return
//   2. resolve trade (entry.assumedTradeId ?? fallback map) → null possible
//   3. pickMh + qty → laborHours
//   4. find rate by (tradeId, regionId, shopType); if found pick by mhRangeMode
//   5. laborCostCents = round(laborHours × rate)  OR null if no rate
//   6. if scope === 'service_and_material': findBestMaterial + waste + subtotal
//   7. buildConfidence (0..100); needsReview if <70 OR no rate OR needs+missing material
// =============================================================================
describe('priceClassification', () => {
  describe('Happy path', () => {
    it('returns a fully-priced result with labor + material when everything matches', () => {
      // Note: input.name needs to overlap m1's tokens at ≥ 0.6 to clear the
      // material threshold. m1.name='Hardie cement siding plank' tokenizes
      // to {hardie, cement, siding, plank}. Using 'hardie cement siding'
      // gives 3/3 = 1.0 (+ 0.05 division bonus) — comfortably above 0.6.
      const input: PricingInput = {
        externalId: 'SDFC',
        name: 'hardie cement siding',
        uom: 'sf',
        quantity: 100,
        scope: 'service_and_material',
      };
      const result = priceClassification(input, baseConfig, baseRefs);

      // Productivity matched p1 by code → high confidence path
      expect(result.productivityEntryId).toBe('p1');
      // p1.assumedTradeId is null → fallback by div-siding → trade-1
      expect(result.laborTradeId).toBe('trade-1');
      // mhRangeMode='avg' → mhPerUnitAvg=0.06 × qty=100 → 6 hours
      expect(result.mhPerUnit).toBe(0.06);
      expect(result.laborHours).toBe(6);
      // rate-1 avg=7000 cents/hr → 6 × 7000 = 42000 cents
      expect(result.laborRateCents).toBe(7000);
      expect(result.laborCostCents).toBe(42000);

      // Material — m1 hardie matches input by tokens; uom sf=sf
      // wastedQty = 100 × 1.10 = 110, subtotal = 110 × 250 = 27500
      expect(result.materialBreakdown).not.toBeNull();
      expect(result.materialBreakdown).toHaveLength(1);
      expect(result.materialBreakdown![0].materialId).toBe('m1');
      expect(result.materialBreakdown![0].qty).toBe(110);
      expect(result.materialBreakdown![0].wastePercent).toBe(10);
      expect(result.materialBreakdown![0].subtotalCents).toBe(27500);
      expect(result.materialCostCents).toBe(27500);

      // Meta — code match + trade + rate + material → high confidence
      expect(result.suggestedByAi).toBe(true);
      expect(result.aiConfidence).toBeGreaterThanOrEqual(70);
      expect(result.needsReview).toBe(false);
      expect(result.notes).toEqual([]);
    });

    it('respects mhRangeMode=low for both mh and rate picks', () => {
      // Build a productivity row with distinct low/avg/high so we can tell
      // which branch ran.
      const prodWithRange: RefProductivity = {
        ...prodCatalog[0],
        mhPerUnitLow: 0.04,
        mhPerUnitAvg: 0.06,
        mhPerUnitHigh: 0.08,
      };
      const refs = { ...baseRefs, productivity: [prodWithRange] };
      const config: PricingConfig = { ...baseConfig, mhRangeMode: 'low' };
      const input: PricingInput = {
        externalId: 'SDFC',
        name: 'fiber cement siding',
        uom: 'sf',
        quantity: 100,
        scope: 'service_and_material',
      };
      const result = priceClassification(input, config, refs);
      expect(result.mhPerUnit).toBe(0.04);
      expect(result.laborHours).toBe(4);
      // rate-1 lowCents=6000 → 4 × 6000 = 24000
      expect(result.laborRateCents).toBe(6000);
      expect(result.laborCostCents).toBe(24000);
    });

    it('respects mhRangeMode=high for both mh and rate picks', () => {
      const prodWithRange: RefProductivity = {
        ...prodCatalog[0],
        mhPerUnitLow: 0.04,
        mhPerUnitAvg: 0.06,
        mhPerUnitHigh: 0.08,
      };
      const refs = { ...baseRefs, productivity: [prodWithRange] };
      const config: PricingConfig = { ...baseConfig, mhRangeMode: 'high' };
      const input: PricingInput = {
        externalId: 'SDFC',
        name: 'fiber cement siding',
        uom: 'sf',
        quantity: 100,
        scope: 'service_and_material',
      };
      const result = priceClassification(input, config, refs);
      expect(result.mhPerUnit).toBe(0.08);
      expect(result.laborHours).toBe(8);
      // rate-1 highCents=8000 → 8 × 8000 = 64000
      expect(result.laborRateCents).toBe(8000);
      expect(result.laborCostCents).toBe(64000);
    });
  });

  describe('Trade resolution', () => {
    it('uses prod.entry.assumedTradeId when present (skips fallback map)', () => {
      // Override p1 to have an explicit trade — shouldn't consult the map.
      const prodWithTrade: RefProductivity = {
        ...prodCatalog[0],
        assumedTradeId: 'trade-1',
      };
      // Empty fallback map proves the assumedTradeId path was taken.
      const refs = {
        ...baseRefs,
        productivity: [prodWithTrade],
        fallbackTradeByDivisionId: new Map<string, string>(),
      };
      const input: PricingInput = {
        externalId: 'SDFC',
        name: 'fiber cement siding',
        uom: 'sf',
        quantity: 100,
        scope: 'service',
      };
      const result = priceClassification(input, baseConfig, refs);
      expect(result.laborTradeId).toBe('trade-1');
      expect(result.laborRateCents).toBe(7000);
    });

    it('falls back to fallbackTradeByDivisionId when assumedTradeId is null', () => {
      // p1.assumedTradeId is null in the base fixture; map keys div-siding→trade-1.
      const input: PricingInput = {
        externalId: 'SDFC',
        name: 'fiber cement siding',
        uom: 'sf',
        quantity: 100,
        scope: 'service',
      };
      const result = priceClassification(input, baseConfig, baseRefs);
      expect(result.laborTradeId).toBe('trade-1');
      expect(result.notes).not.toContain(
        'No assumed trade on productivity entry — pick one to price labor.',
      );
    });

    it('returns null tradeId and adds note when neither assumedTradeId nor fallback resolves', () => {
      // Empty fallback map + no assumedTradeId → tradeId=null path
      const refs = {
        ...baseRefs,
        fallbackTradeByDivisionId: new Map<string, string>(),
      };
      const input: PricingInput = {
        externalId: 'SDFC',
        name: 'fiber cement siding',
        uom: 'sf',
        quantity: 100,
        scope: 'service',
      };
      const result = priceClassification(input, baseConfig, refs);
      expect(result.laborTradeId).toBeNull();
      expect(result.laborRateCents).toBeNull();
      expect(result.laborCostCents).toBeNull();
      expect(result.notes).toContain(
        'No assumed trade on productivity entry — pick one to price labor.',
      );
      // No rate → needsReview=true
      expect(result.needsReview).toBe(true);
    });

    it('adds a note and leaves laborCostCents null when trade resolves but rate is missing', () => {
      // p2's div-rough → trade-2, but laborRates has no row for trade-2.
      const input: PricingInput = {
        externalId: 'RCFRMW',
        name: 'frame exterior wall stud',
        uom: 'sf',
        quantity: 50,
        scope: 'service',
      };
      const result = priceClassification(input, baseConfig, baseRefs);
      expect(result.laborTradeId).toBe('trade-2');
      expect(result.laborRateCents).toBeNull();
      expect(result.laborCostCents).toBeNull();
      expect(result.notes.some((n) => n.includes('No open_shop rate'))).toBe(true);
      expect(result.needsReview).toBe(true);
    });
  });

  describe('No-match path', () => {
    it('returns minimal needsReview result when productivity does not match', () => {
      const input: PricingInput = {
        externalId: null,
        name: 'underwater scuba diving equipment',
        uom: 'sf',
        quantity: 10,
        scope: 'service_and_material',
      };
      const result = priceClassification(input, baseConfig, baseRefs);
      expect(result.productivityEntryId).toBeNull();
      expect(result.laborTradeId).toBeNull();
      expect(result.mhPerUnit).toBeNull();
      expect(result.laborHours).toBeNull();
      expect(result.laborRateCents).toBeNull();
      expect(result.laborCostCents).toBeNull();
      expect(result.materialCostCents).toBeNull();
      expect(result.materialBreakdown).toBeNull();
      expect(result.suggestedByAi).toBe(false);
      expect(result.aiConfidence).toBe(0);
      expect(result.needsReview).toBe(true);
      expect(result.notes).toContain('No productivity match — fill labor manually.');
    });
  });

  describe('Material handling', () => {
    it('skips material lookup entirely when scope is "service" (labor only)', () => {
      const input: PricingInput = {
        externalId: 'SDFC',
        name: 'fiber cement siding',
        uom: 'sf',
        quantity: 100,
        scope: 'service',
      };
      const result = priceClassification(input, baseConfig, baseRefs);
      expect(result.materialCostCents).toBeNull();
      expect(result.materialBreakdown).toBeNull();
      // No "no material match" note — we never tried.
      expect(result.notes).not.toContain('No material match — add materials manually.');
    });

    it('returns null materialCostCents and adds note when no material matches', () => {
      // Match prod via p3 (TPO roofing) but the materials catalog has no
      // TPO-relevant tokens that overlap with input "tpo membrane work" at
      // ≥ 0.6. Actually m3 IS "TPO membrane roofing" sf — input tokens
      // {tpo, membrane, work} ∩ {tpo, membrane, roofing} = {tpo, membrane}
      // size 2, min(3,3)=3 → 0.667 ≥ 0.6 → matches. Use a name with no
      // overlap to force the no-match branch.
      const input: PricingInput = {
        externalId: 'SDFC',
        name: 'completely unrelated mystery substance',
        uom: 'sf',
        quantity: 10,
        scope: 'service_and_material',
      };
      const result = priceClassification(input, baseConfig, baseRefs);
      // Productivity matched by code → still got labor
      expect(result.productivityEntryId).toBe('p1');
      expect(result.laborCostCents).not.toBeNull();
      // Material — no overlap with any matCatalog row → null
      expect(result.materialCostCents).toBeNull();
      expect(result.materialBreakdown).toBeNull();
      expect(result.notes).toContain('No material match — add materials manually.');
      expect(result.needsReview).toBe(true);
    });

    it('rounds wasted qty to 4 decimals and subtotal to integer cents', () => {
      // 13.37 × 1.10 = 14.707 → kept (4 decimals safe)
      // subtotal = 14.707 × 250 = 3676.75 → round → 3677
      const input: PricingInput = {
        externalId: 'SDFC',
        name: 'hardie cement siding',
        uom: 'sf',
        quantity: 13.37,
        scope: 'service_and_material',
      };
      const result = priceClassification(input, baseConfig, baseRefs);
      expect(result.materialBreakdown).not.toBeNull();
      expect(result.materialBreakdown![0].qty).toBe(14.707);
      expect(result.materialBreakdown![0].subtotalCents).toBe(3677);
      expect(result.materialCostCents).toBe(3677);
    });
  });

  describe('Confidence and needsReview', () => {
    it('matchedByCode adds +15 to confidence vs a keyword-only match', () => {
      // Code match: 60 (score=1) + 15 (code) + 10 (trade+rate) + 15 (material) = 100
      const codeInput: PricingInput = {
        externalId: 'SDFC',
        name: 'hardie cement siding',
        uom: 'sf',
        quantity: 100,
        scope: 'service_and_material',
      };
      const codeResult = priceClassification(codeInput, baseConfig, baseRefs);
      expect(codeResult.aiConfidence).toBe(100);

      // Keyword-only: same name+material but externalId=null forces L2 path.
      // Tokens {hardie, cement, siding} vs p1.matchKeywords {fiber, cement,
      // siding, panel, install} = overlap {cement, siding} = 2, min(3,5)=3
      // → 0.667. Confidence = round(0.667*60) + 0 + 10 + 15 = 40+25 = 65
      const keyInput: PricingInput = { ...codeInput, externalId: null };
      const keyResult = priceClassification(keyInput, baseConfig, baseRefs);
      expect(keyResult.aiConfidence).toBeLessThan(codeResult.aiConfidence);
      expect(codeResult.aiConfidence - keyResult.aiConfidence).toBeGreaterThanOrEqual(15);
    });

    it('flags needsReview=true when confidence < 70 even if rate + material resolved', () => {
      // Force low fuzzy score to drive confidence under 70.
      const keyInput: PricingInput = {
        externalId: null,
        name: 'hardie cement siding',
        uom: 'sf',
        quantity: 100,
        scope: 'service_and_material',
      };
      const result = priceClassification(keyInput, baseConfig, baseRefs);
      expect(result.aiConfidence).toBeLessThan(70);
      expect(result.laborRateCents).not.toBeNull();
      expect(result.materialCostCents).not.toBeNull();
      expect(result.needsReview).toBe(true);
    });

    it('flags needsReview=true when needsMaterial but no material matched', () => {
      const input: PricingInput = {
        externalId: 'SDFC',
        name: 'completely unrelated mystery substance',
        uom: 'sf',
        quantity: 10,
        scope: 'service_and_material',
      };
      const result = priceClassification(input, baseConfig, baseRefs);
      expect(result.materialCostCents).toBeNull();
      expect(result.needsReview).toBe(true);
    });
  });
});

// =============================================================================
// priceWithProductivity
//
// Like priceClassification but the productivity row is selected by id (no
// fuzzy match). Adds two early-return guards:
//   - id not in catalog → degraded result with explanatory note
//   - UOM mismatch (after FT↔LF synonym tolerance) → degraded result
// Confidence is built with productivityScore=1 + matchedByCode=true (resolver
// path is treated as deterministic).
// =============================================================================
describe('priceWithProductivity', () => {
  describe('Happy path', () => {
    it('returns full PricingResult by direct id lookup (no fuzzy match)', () => {
      const input: PricingInput = {
        externalId: null, // ignored by this function
        name: 'whatever name we want', // ignored for productivity, used for material
        uom: 'sf',
        quantity: 100,
        scope: 'service_and_material',
      };
      const result = priceWithProductivity('p1', input, baseConfig, baseRefs);
      expect(result.productivityEntryId).toBe('p1');
      expect(result.laborTradeId).toBe('trade-1');
      expect(result.laborHours).toBe(6);
      expect(result.laborRateCents).toBe(7000);
      expect(result.laborCostCents).toBe(42000);
      // suggestedByAi is FALSE on this path — resolver is deterministic
      expect(result.suggestedByAi).toBe(false);
      expect(result.aiConfidence).toBeGreaterThanOrEqual(70);
    });

    it('still runs material fuzzy match against input.name', () => {
      // Productivity is locked to p1 by id, but materials still go through
      // findBestMaterial against the input name.
      const input: PricingInput = {
        externalId: null,
        name: 'hardie cement siding',
        uom: 'sf',
        quantity: 100,
        scope: 'service_and_material',
      };
      const result = priceWithProductivity('p1', input, baseConfig, baseRefs);
      expect(result.materialBreakdown).not.toBeNull();
      expect(result.materialBreakdown![0].materialId).toBe('m1');
      expect(result.materialCostCents).toBe(27500);
    });
  });

  describe('UOM mismatch', () => {
    it('returns degraded needsReview result when UOM truly mismatches', () => {
      // p1.uom='sf'. Pass uom='ea' → not compatible, not FT↔LF → degrade.
      const input: PricingInput = {
        externalId: null,
        name: 'whatever',
        uom: 'ea',
        quantity: 10,
        scope: 'service_and_material',
      };
      const result = priceWithProductivity('p1', input, baseConfig, baseRefs);
      expect(result.productivityEntryId).toBeNull();
      expect(result.laborHours).toBeNull();
      expect(result.laborRateCents).toBeNull();
      expect(result.materialCostCents).toBeNull();
      expect(result.aiConfidence).toBe(0);
      expect(result.needsReview).toBe(true);
      expect(result.notes.some((n) => n.includes('UOM mismatch'))).toBe(true);
    });

    it('tolerates FT↔LF synonym without degrading', () => {
      // Build a row with uom='lf' and pass uom='ft' → should NOT degrade.
      const ftLfProd: RefProductivity = {
        ...prodCatalog[0],
        id: 'p-ftlf',
        uom: 'lf',
      };
      const refs = { ...baseRefs, productivity: [ftLfProd] };
      const input: PricingInput = {
        externalId: null,
        name: 'whatever',
        uom: 'ft',
        quantity: 100,
        scope: 'service',
      };
      const result = priceWithProductivity('p-ftlf', input, baseConfig, refs);
      // Did NOT degrade — labor is computed
      expect(result.productivityEntryId).toBe('p-ftlf');
      expect(result.laborHours).toBe(6);
      expect(result.notes.every((n) => !n.includes('UOM mismatch'))).toBe(true);
    });

    it('does NOT tolerate SF↔SY at this guard (stricter than findBestMaterial)', () => {
      // priceWithProductivity only excuses FT↔LF. SF↔SY (which
      // findBestMaterial DOES accept) still degrades here. Documents the
      // intentional asymmetry: the resolver guard is paranoid.
      const syProd: RefProductivity = {
        ...prodCatalog[0],
        id: 'p-sy',
        uom: 'sy',
      };
      const refs = { ...baseRefs, productivity: [syProd] };
      const input: PricingInput = {
        externalId: null,
        name: 'whatever',
        uom: 'sf',
        quantity: 100,
        scope: 'service',
      };
      const result = priceWithProductivity('p-sy', input, baseConfig, refs);
      expect(result.productivityEntryId).toBeNull();
      expect(result.notes.some((n) => n.includes('UOM mismatch'))).toBe(true);
    });
  });

  describe('Stale id', () => {
    it('returns degraded result with explanatory note when id is not in catalog', () => {
      const input: PricingInput = {
        externalId: null,
        name: 'whatever',
        uom: 'sf',
        quantity: 10,
        scope: 'service_and_material',
      };
      const result = priceWithProductivity('does-not-exist', input, baseConfig, baseRefs);
      expect(result.productivityEntryId).toBeNull();
      expect(result.laborHours).toBeNull();
      expect(result.materialCostCents).toBeNull();
      expect(result.aiConfidence).toBe(0);
      expect(result.needsReview).toBe(true);
      expect(result.notes).toContain(
        'Resolver returned a productivity id that no longer exists in the catalog.',
      );
    });
  });

  describe('Confidence and needsReview', () => {
    it('does NOT use the <70 confidence threshold in needsReview (only rate + material checks)', () => {
      // priceClassification flags needsReview when confidence<70. This
      // function uses a narrower test: only `no rate` or `needs+missing
      // material`. Verify by passing a service-only line where rate exists
      // → needsReview should be FALSE even if some confidence component
      // were absent.
      const input: PricingInput = {
        externalId: null,
        name: 'whatever',
        uom: 'sf',
        quantity: 100,
        scope: 'service',
      };
      const result = priceWithProductivity('p1', input, baseConfig, baseRefs);
      expect(result.laborRateCents).not.toBeNull();
      expect(result.needsReview).toBe(false);
    });

    it('flags needsReview=true when needs material but no material matches', () => {
      const input: PricingInput = {
        externalId: null,
        name: 'completely unrelated mystery substance',
        uom: 'sf',
        quantity: 100,
        scope: 'service_and_material',
      };
      const result = priceWithProductivity('p1', input, baseConfig, baseRefs);
      expect(result.materialCostCents).toBeNull();
      expect(result.needsReview).toBe(true);
    });
  });
});

// =============================================================================
// rollupTotals
//
// Pure arithmetic on the line-level subtotals. Key invariants under test:
//   - null laborCostCents / materialCostCents treated as 0
//   - Cost factors of the same `appliesTo` sum ADDITIVELY (not multiplicatively)
//   - OH&P is FLAT — each percent applies to directCost, not cascaded
//   - Sales tax base is (directCost + ohpTotal), i.e. tax is applied last
//   - Rounding: each component is rounded to integer cents at the boundary
// =============================================================================
describe('rollupTotals', () => {
  // Convenience helper for the all-zero-margin case used in the basic tests.
  const zeroMargins = {
    markupPercent: null,
    overheadPercent: null,
    generalConditionsPercent: null,
    contingencyPercent: null,
    salesTaxPercent: null,
  };

  describe('Basic summing', () => {
    it('sums labor and material across multiple lines', () => {
      const lines = [
        { laborCostCents: 1000, materialCostCents: 2000 },
        { laborCostCents: 3000, materialCostCents: 4000 },
        { laborCostCents: 500, materialCostCents: 100 },
      ];
      const result = rollupTotals(lines, [], zeroMargins);
      expect(result.laborCostCents).toBe(4500);
      expect(result.materialCostCents).toBe(6100);
      // No factors → factored equals raw
      expect(result.laborFactoredCents).toBe(4500);
      expect(result.materialFactoredCents).toBe(6100);
      expect(result.directCostCents).toBe(10600);
    });

    it('treats null laborCostCents and materialCostCents as 0', () => {
      const lines = [
        { laborCostCents: 1000, materialCostCents: null },
        { laborCostCents: null, materialCostCents: 2000 },
        { laborCostCents: null, materialCostCents: null },
      ];
      const result = rollupTotals(lines, [], zeroMargins);
      expect(result.laborCostCents).toBe(1000);
      expect(result.materialCostCents).toBe(2000);
      expect(result.directCostCents).toBe(3000);
    });

    it('returns all zeros for an empty lines array', () => {
      const result = rollupTotals([], [], zeroMargins);
      expect(result.laborCostCents).toBe(0);
      expect(result.materialCostCents).toBe(0);
      expect(result.laborFactoredCents).toBe(0);
      expect(result.materialFactoredCents).toBe(0);
      expect(result.directCostCents).toBe(0);
      expect(result.generalConditionsCents).toBe(0);
      expect(result.overheadCents).toBe(0);
      expect(result.contingencyCents).toBe(0);
      expect(result.markupCents).toBe(0);
      expect(result.ohpTotalCents).toBe(0);
      expect(result.salesTaxCents).toBe(0);
      expect(result.totalCents).toBe(0);
    });

    it('treats null margin percents as 0 (no GC, OH, contingency, markup, tax)', () => {
      const lines = [{ laborCostCents: 100000, materialCostCents: 50000 }];
      const result = rollupTotals(lines, [], zeroMargins);
      expect(result.directCostCents).toBe(150000);
      expect(result.generalConditionsCents).toBe(0);
      expect(result.overheadCents).toBe(0);
      expect(result.contingencyCents).toBe(0);
      expect(result.markupCents).toBe(0);
      expect(result.ohpTotalCents).toBe(0);
      expect(result.salesTaxCents).toBe(0);
      expect(result.totalCents).toBe(150000);
    });
  });

  describe('Cost factors (additive within type)', () => {
    it('sums multiple labor factors ADDITIVELY (not multiplicatively)', () => {
      // Two labor factors of 0.10 each → 1 + 0.20 = 1.20, NOT 1.10² = 1.21
      const lines = [{ laborCostCents: 100000, materialCostCents: 0 }];
      const factors: AppliedFactor[] = [
        { appliesTo: 'labor', impactPercent: 0.1 },
        { appliesTo: 'labor', impactPercent: 0.1 },
      ];
      const result = rollupTotals(lines, factors, zeroMargins);
      expect(result.laborFactoredCents).toBe(120000); // additive
      expect(result.laborFactoredCents).not.toBe(121000); // not multiplicative
    });

    it('applies labor factors only to labor (material untouched)', () => {
      const lines = [{ laborCostCents: 100000, materialCostCents: 50000 }];
      const factors: AppliedFactor[] = [{ appliesTo: 'labor', impactPercent: 0.2 }];
      const result = rollupTotals(lines, factors, zeroMargins);
      expect(result.laborFactoredCents).toBe(120000);
      expect(result.materialFactoredCents).toBe(50000);
    });

    it('applies material factors only to material (labor untouched)', () => {
      const lines = [{ laborCostCents: 100000, materialCostCents: 50000 }];
      const factors: AppliedFactor[] = [{ appliesTo: 'material', impactPercent: 0.1 }];
      const result = rollupTotals(lines, factors, zeroMargins);
      expect(result.laborFactoredCents).toBe(100000);
      expect(result.materialFactoredCents).toBe(55000);
    });

    it('overhead factor multiplies the overhead computation only (not direct cost)', () => {
      // overhead = direct × OH% × (1 + overheadFactor). With direct=100000,
      // OH=10%, overheadFactor=0.5 → 100000 × 0.10 × 1.5 = 15000. Other
      // OH&P components untouched.
      const lines = [{ laborCostCents: 100000, materialCostCents: 0 }];
      const factors: AppliedFactor[] = [{ appliesTo: 'overhead', impactPercent: 0.5 }];
      const margins = { ...zeroMargins, overheadPercent: 10 };
      const result = rollupTotals(lines, factors, margins);
      expect(result.directCostCents).toBe(100000); // direct unaffected
      expect(result.overheadCents).toBe(15000);
    });
  });

  describe('OH&P FLAT math', () => {
    it('GC = directCost × GC% (rounded)', () => {
      // direct=100000, GC=8% → 8000
      const lines = [{ laborCostCents: 100000, materialCostCents: 0 }];
      const margins = { ...zeroMargins, generalConditionsPercent: 8 };
      const result = rollupTotals(lines, [], margins);
      expect(result.generalConditionsCents).toBe(8000);
    });

    it('Overhead = directCost × OH% × (1 + overheadFactor) (rounded)', () => {
      const lines = [{ laborCostCents: 100000, materialCostCents: 0 }];
      const margins = { ...zeroMargins, overheadPercent: 10 };
      const result = rollupTotals(lines, [], margins);
      // direct=100000 × 0.10 × 1.0 = 10000
      expect(result.overheadCents).toBe(10000);
    });

    it('Contingency = directCost × cont% (rounded)', () => {
      const lines = [{ laborCostCents: 100000, materialCostCents: 0 }];
      const margins = { ...zeroMargins, contingencyPercent: 5 };
      const result = rollupTotals(lines, [], margins);
      expect(result.contingencyCents).toBe(5000);
    });

    it('Markup = directCost × markup% (rounded)', () => {
      const lines = [{ laborCostCents: 100000, materialCostCents: 0 }];
      const margins = { ...zeroMargins, markupPercent: 15 };
      const result = rollupTotals(lines, [], margins);
      expect(result.markupCents).toBe(15000);
    });

    it('OH&P percents do NOT cascade — each is independently × directCost', () => {
      // direct=100000. GC=10% (10000), OH=10% (10000). FLAT total = 20000.
      // If they cascaded, GC over (direct+OH) would yield 11000. We assert
      // the FLAT shape.
      const lines = [{ laborCostCents: 100000, materialCostCents: 0 }];
      const margins = {
        ...zeroMargins,
        generalConditionsPercent: 10,
        overheadPercent: 10,
      };
      const result = rollupTotals(lines, [], margins);
      expect(result.generalConditionsCents).toBe(10000);
      expect(result.overheadCents).toBe(10000);
      expect(result.ohpTotalCents).toBe(20000);
    });

    it('ohpTotalCents is the sum of GC + Overhead + Contingency + Markup', () => {
      const lines = [{ laborCostCents: 100000, materialCostCents: 0 }];
      const margins = {
        ...zeroMargins,
        generalConditionsPercent: 8,
        overheadPercent: 10,
        contingencyPercent: 5,
        markupPercent: 15,
      };
      const result = rollupTotals(lines, [], margins);
      const expected =
        result.generalConditionsCents +
        result.overheadCents +
        result.contingencyCents +
        result.markupCents;
      expect(result.ohpTotalCents).toBe(expected);
      expect(result.ohpTotalCents).toBe(38000);
    });
  });

  describe('Sales tax', () => {
    it('sales tax base includes OH&P (applied to directCost + ohpTotal)', () => {
      // direct=100000, GC=10% → 10000, OH&P total=10000.
      // beforeTax=110000. salesTax 5% = 5500. Total = 115500.
      const lines = [{ laborCostCents: 100000, materialCostCents: 0 }];
      const margins = {
        ...zeroMargins,
        generalConditionsPercent: 10,
        salesTaxPercent: 5,
      };
      const result = rollupTotals(lines, [], margins);
      expect(result.ohpTotalCents).toBe(10000);
      expect(result.salesTaxCents).toBe(5500);
      expect(result.totalCents).toBe(115500);
    });

    it('sales tax = 0 when salesTaxPercent is null', () => {
      const lines = [{ laborCostCents: 100000, materialCostCents: 0 }];
      const result = rollupTotals(lines, [], zeroMargins);
      expect(result.salesTaxCents).toBe(0);
      expect(result.totalCents).toBe(result.directCostCents + result.ohpTotalCents);
    });
  });

  describe('Combined scenario — full pipeline with all 12 fields', () => {
    it('produces the exact expected values across the full calculation', () => {
      // Manually traced, matching the function's rounding boundaries.
      //   labor=70000, material=40000
      //   laborFactor=0.10  → laborFactored = 70000 × 1.10 = 77000
      //   materialFactor=0.05 → materialFactored = 40000 × 1.05 = 42000
      //   directCost = 77000 + 42000 = 119000
      //
      //   GC          = 119000 × 0.08          = 9520
      //   Overhead    = 119000 × 0.12 × 1.20   = 17136
      //   Contingency = 119000 × 0.05          = 5950
      //   Markup      = 119000 × 0.15          = 17850
      //   ohpTotal    = 9520 + 17136 + 5950 + 17850 = 50456
      //
      //   beforeTax = 119000 + 50456 = 169456
      //   salesTax  = round(169456 × 0.0625) = round(10591.0) = 10591
      //   total     = 169456 + 10591 = 180047
      const lines = [
        { laborCostCents: 50000, materialCostCents: 25000 },
        { laborCostCents: 20000, materialCostCents: 15000 },
      ];
      const factors: AppliedFactor[] = [
        { appliesTo: 'labor', impactPercent: 0.1 },
        { appliesTo: 'material', impactPercent: 0.05 },
        { appliesTo: 'overhead', impactPercent: 0.2 },
      ];
      const margins = {
        markupPercent: 15,
        overheadPercent: 12,
        generalConditionsPercent: 8,
        contingencyPercent: 5,
        salesTaxPercent: 6.25,
      };
      const result = rollupTotals(lines, factors, margins);

      expect(result.laborCostCents).toBe(70000);
      expect(result.materialCostCents).toBe(40000);
      expect(result.laborFactoredCents).toBe(77000);
      expect(result.materialFactoredCents).toBe(42000);
      expect(result.directCostCents).toBe(119000);
      expect(result.generalConditionsCents).toBe(9520);
      expect(result.overheadCents).toBe(17136);
      expect(result.contingencyCents).toBe(5950);
      expect(result.markupCents).toBe(17850);
      expect(result.ohpTotalCents).toBe(50456);
      expect(result.salesTaxCents).toBe(10591);
      expect(result.totalCents).toBe(180047);
    });
  });
});
