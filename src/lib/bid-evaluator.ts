import { geocodeAddress } from '@/lib/geocoding';
import { distanceAndBearingFromBoston } from '@/lib/geo';

export type AutoCaptureSettings = {
  enabled: boolean;
  minConfidence: number; // 0-100
  allowedStates: string[]; // ['MA', 'NH', ...] uppercase 2-letter
  qualifiedStatus: 'new' | 'qualified';
  maxDistanceMiles: number;
};

export type EvalDecision =
  | { decision: 'auto_create_qualified'; lat: number | null; lng: number | null; distanceMiles: number | null; reason: null; rule: null }
  | { decision: 'auto_create_rejected'; lat: number | null; lng: number | null; distanceMiles: number | null; reason: string; rule: 'distance' | 'state' }
  | { decision: 'needs_manual_review'; lat: null; lng: null; distanceMiles: null; reason: string; rule: 'low_confidence' | 'auto_disabled' };

type ExtractedAddressInput = {
  projectAddress: string | null;
  /** A 2-letter state code if the model surfaced one. Otherwise we try to parse from the address. */
  stateHint?: string | null;
};

/** Pull a 2-letter state code from an address string. Looks for ", XX " or ", XX," or trailing ", XX". */
function inferStateFromAddress(addr: string | null): string | null {
  if (!addr) return null;
  // Match "..., XX[ ZIP]" — XX must be 2 uppercase letters preceded by comma+space
  const m = addr.match(/,\s*([A-Z]{2})(?:[\s,]|$)/);
  if (m) return m[1].toUpperCase();
  // Fallback: any standalone 2-letter token at end
  const tail = addr
    .trim()
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);
  for (let i = tail.length - 1; i >= 0; i--) {
    const t = tail[i].toUpperCase();
    if (/^[A-Z]{2}$/.test(t) && US_STATES.has(t)) return t;
  }
  return null;
}

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]);

/**
 * Evaluate whether a bid extracted by Claude should be auto-created.
 * Distance is the dominant rule. State list is a fallback for ungeocodable addresses.
 *
 * Branches:
 *   1. Auto-capture disabled → needs_manual_review
 *   2. Confidence below threshold → needs_manual_review
 *   3. Address geocodes:
 *      - distance ≤ max → auto_create_qualified
 *      - distance > max → auto_create_rejected (rule=distance)
 *   4. Address doesn't geocode (or no address):
 *      - Try to infer state code
 *      - state ∈ allowed → auto_create_qualified (with no distance)
 *      - state ∉ allowed (or unknown) → auto_create_rejected (rule=state)
 */
export async function evaluateBid(
  input: ExtractedAddressInput & { confidence: number },
  settings: AutoCaptureSettings
): Promise<EvalDecision> {
  if (!settings.enabled) {
    return {
      decision: 'needs_manual_review',
      lat: null,
      lng: null,
      distanceMiles: null,
      reason: 'Auto-capture disabled in Settings',
      rule: 'auto_disabled',
    };
  }

  if (input.confidence < settings.minConfidence) {
    return {
      decision: 'needs_manual_review',
      lat: null,
      lng: null,
      distanceMiles: null,
      reason: `Confidence ${input.confidence}% below threshold ${settings.minConfidence}%`,
      rule: 'low_confidence',
    };
  }

  // Try geocoding
  let lat: number | null = null;
  let lng: number | null = null;
  let miles: number | null = null;
  if (input.projectAddress) {
    try {
      const geo = await geocodeAddress(input.projectAddress);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        const calc = distanceAndBearingFromBoston(geo.lat, geo.lng);
        miles = Math.round(calc.miles * 10) / 10;
      }
    } catch {
      // Treat as ungeocodable; fall through to state check
    }
  }

  if (miles !== null) {
    if (miles <= settings.maxDistanceMiles) {
      return {
        decision: 'auto_create_qualified',
        lat,
        lng,
        distanceMiles: miles,
        reason: null,
        rule: null,
      };
    }
    return {
      decision: 'auto_create_rejected',
      lat,
      lng,
      distanceMiles: miles,
      reason: `Distance ${miles}mi exceeds ${settings.maxDistanceMiles}mi rule`,
      rule: 'distance',
    };
  }

  // Fallback to state check
  const state = (input.stateHint?.toUpperCase()
    ?? inferStateFromAddress(input.projectAddress));

  if (!state) {
    return {
      decision: 'auto_create_rejected',
      lat: null,
      lng: null,
      distanceMiles: null,
      reason: 'Address not geocodable and no state could be inferred',
      rule: 'state',
    };
  }

  if (settings.allowedStates.includes(state)) {
    return {
      decision: 'auto_create_qualified',
      lat: null,
      lng: null,
      distanceMiles: null,
      reason: null,
      rule: null,
    };
  }

  return {
    decision: 'auto_create_rejected',
    lat: null,
    lng: null,
    distanceMiles: null,
    reason: `State ${state} not in allowed list (${settings.allowedStates.join(', ')})`,
    rule: 'state',
  };
}
