import { describe, it, expect } from 'vitest';
import {
  sectionForDivision,
  resolveFallbackTrade,
  type RefLaborTrade,
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
