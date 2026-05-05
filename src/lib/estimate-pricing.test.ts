import { describe, it, expect } from 'vitest';
import {
  sectionForDivision,
  resolveFallbackTrade,
  findBestProductivity,
  findBestMaterial,
  type RefLaborTrade,
  type RefProductivity,
  type RefMaterial,
  type PricingInput,
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
