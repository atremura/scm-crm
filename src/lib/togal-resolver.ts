/**
 * Deterministic L1/L2 classification resolver.
 *
 * Goal: bind a Togal-imported Classification to a ProductivityEntry by
 * matchCode prefix BEFORE any fuzzy/AI step runs. This is what makes the
 * Estimate module mostly determinístico — when Andre/Cowork name their
 * Togal items with the convention "ELFCS-1 ...", "EL02A ...", etc., the
 * resolver just looks up the matchCode and we're done. AI is reserved for
 * the long tail.
 *
 * Four regras, in order:
 *   1. Togal `ID` field → exact matchCode lookup
 *   2. Togal `Name` prefix (regex) → matchCode lookup
 *   3. Togal `Folder` field → Division lookup (informational only — AI
 *      can still use this as pre-filter)
 *   4. Unresolved → caller falls through to fuzzy/AI
 *
 * UOM lock (L5 validator): when a productivity matches by 1 or 2 but its
 * UOM disagrees with the takeoff UOM, we DON'T assign it. The resolver
 * sets uomMismatch=true and the caller treats the line as needsReview
 * (Andre fixes the productivity entry or picks manually). This kills the
 * Z-girt/Kanso bug at the source.
 *
 * Pure functions, no Prisma. Caller loads productivities + divisions and
 * passes them in.
 */

// ============================================================
// Types
// ============================================================

export type ResolverProductivity = {
  id: string;
  divisionId: string;
  uom: string;
  matchCode: string | null;
  scopeName: string;
};

export type ResolverDivision = {
  id: string;
  name: string;
};

export type ResolverInput = {
  togalId: string | null;
  togalFolder: string | null;
  name: string;
  externalId: string | null;
  uom: string;
};

export type ResolverSource =
  | 'togal-id'        // Togal "ID (Optional)" field exact-matched a productivity matchCode
  | 'togal-prefix'    // Name prefix regex matched a productivity matchCode
  | 'togal-folder'    // Only the Folder mapped — divisionId set, productivity null
  | 'unresolved';     // None of the regras hit — caller falls through to fuzzy/AI

export type ResolverResult = {
  productivityEntryId: string | null;
  divisionId: string | null;
  source: ResolverSource;
  /** 0-100. 100 = togal-id exact, 95 = togal-prefix, 70 = togal-folder, 0 = unresolved. */
  confidence: number;
  /** The matchCode that matched, if any. Useful for debugging + audit. */
  matchedCode: string | null;
  /** True when a productivity DID match by code, but its UOM disagreed with the
   *  takeoff UOM. Caller MUST treat the line as needsReview and not apply the
   *  productivity. This is the L5 structural validator. */
  uomMismatch: boolean;
  /** Human-readable explanation, surfaced as a note on the EstimateLine. */
  reason: string;
};

// ============================================================
// Regex + helpers
// ============================================================

/**
 * Pulls a likely matchCode from the start of a Togal classification name.
 *
 *   ELFCS-1 JAMES HARDIE             → "ELFCS"   (strip suffix after dash)
 *   ELFCSS - JAMES HARDIE            → "ELFCSS"
 *   EL02A 4/4X8 FIBER CEMENT         → "EL02"   (strip trailing letter when preceded by digits)
 *   EL11 4/4X6 FIBER CEMENT          → "EL11"
 *   A1 WINDOWS                       → "A1"
 *   POCKET DOOR                      → null     (no leading code-shape)
 *
 * The regex grabs the first uppercase token (letters/digits/dashes). We
 * then progressively strip suffixes the catalog likely doesn't carry, so
 * "ELFCS-1" still matches a productivity whose matchCode is "ELFCS".
 */
const PREFIX_REGEX = /^([A-Z][A-Z0-9]{0,7}(?:-[A-Z0-9]{1,4})?)/;

export function extractCandidateCodes(rawLabel: string): string[] {
  if (!rawLabel) return [];
  const trimmed = rawLabel.trim().toUpperCase();
  const m = trimmed.match(PREFIX_REGEX);
  if (!m) return [];
  const full = m[1]; // e.g. "ELFCS-1" or "EL02A"

  const candidates = new Set<string>();
  candidates.add(full);

  // Strip trailing "-N" / "-NN"  (ELFCS-1 → ELFCS)
  const dashStripped = full.replace(/-[A-Z0-9]+$/, '');
  if (dashStripped !== full) candidates.add(dashStripped);

  // Strip trailing single uppercase letter when preceded by digits (EL02A → EL02)
  const letterSuffix = dashStripped.replace(/(\d)[A-Z]$/, '$1');
  if (letterSuffix !== dashStripped) candidates.add(letterSuffix);

  return Array.from(candidates);
}

function findProductivityByCode(
  code: string,
  rows: ResolverProductivity[]
): ResolverProductivity | null {
  const target = code.trim().toUpperCase();
  for (const r of rows) {
    if (r.matchCode && r.matchCode.trim().toUpperCase() === target) return r;
  }
  return null;
}

function findDivisionByFolderName(
  folder: string,
  divisions: ResolverDivision[]
): ResolverDivision | null {
  const target = folder.trim().toLowerCase();
  if (!target) return null;
  // Exact case-insensitive
  for (const d of divisions) {
    if (d.name.trim().toLowerCase() === target) return d;
  }
  // Substring contains either way (Folder "Siding & Cladding" → Division "Siding")
  for (const d of divisions) {
    const dn = d.name.trim().toLowerCase();
    if (dn.includes(target) || target.includes(dn)) return d;
  }
  return null;
}

function uomEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const A = a.trim().toUpperCase();
  const B = b.trim().toUpperCase();
  if (A === B) return true;
  // Togal sometimes uses "FT" where the catalog uses "LF"; accept the synonym.
  if ((A === 'FT' && B === 'LF') || (A === 'LF' && B === 'FT')) return true;
  return false;
}

// ============================================================
// Main
// ============================================================

export function resolveClassification(
  input: ResolverInput,
  refs: {
    productivities: ResolverProductivity[];
    divisions: ResolverDivision[];
  }
): ResolverResult {
  // --- Regra 1: Togal "ID" field exact ---
  if (input.togalId && input.togalId.trim()) {
    const codes = extractCandidateCodes(input.togalId);
    for (const code of codes) {
      const prod = findProductivityByCode(code, refs.productivities);
      if (prod) {
        if (!uomEqual(prod.uom, input.uom)) {
          return {
            productivityEntryId: null,
            divisionId: prod.divisionId,
            source: 'togal-id',
            confidence: 0,
            matchedCode: prod.matchCode,
            uomMismatch: true,
            reason: `Togal ID "${input.togalId}" matched productivity ${prod.matchCode} (${prod.scopeName}) but its UOM is ${prod.uom} ≠ takeoff UOM ${input.uom}. Refusing to apply — needs review.`,
          };
        }
        return {
          productivityEntryId: prod.id,
          divisionId: prod.divisionId,
          source: 'togal-id',
          confidence: 100,
          matchedCode: prod.matchCode,
          uomMismatch: false,
          reason: `Togal ID "${input.togalId}" → matchCode ${prod.matchCode} (${prod.scopeName}).`,
        };
      }
    }
  }

  // --- Regra 1b: legacy externalId fallback (Bid takeoffs predating Togal ID) ---
  if (input.externalId && input.externalId.trim()) {
    const codes = extractCandidateCodes(input.externalId);
    for (const code of codes) {
      const prod = findProductivityByCode(code, refs.productivities);
      if (prod) {
        if (!uomEqual(prod.uom, input.uom)) {
          return {
            productivityEntryId: null,
            divisionId: prod.divisionId,
            source: 'togal-id',
            confidence: 0,
            matchedCode: prod.matchCode,
            uomMismatch: true,
            reason: `External ID "${input.externalId}" matched productivity ${prod.matchCode} but UOM ${prod.uom} ≠ ${input.uom}. Refusing to apply.`,
          };
        }
        return {
          productivityEntryId: prod.id,
          divisionId: prod.divisionId,
          source: 'togal-id',
          confidence: 100,
          matchedCode: prod.matchCode,
          uomMismatch: false,
          reason: `External ID "${input.externalId}" → matchCode ${prod.matchCode} (${prod.scopeName}).`,
        };
      }
    }
  }

  // --- Regra 2: Name prefix regex ---
  const codes = extractCandidateCodes(input.name);
  for (const code of codes) {
    const prod = findProductivityByCode(code, refs.productivities);
    if (prod) {
      if (!uomEqual(prod.uom, input.uom)) {
        return {
          productivityEntryId: null,
          divisionId: prod.divisionId,
          source: 'togal-prefix',
          confidence: 0,
          matchedCode: prod.matchCode,
          uomMismatch: true,
          reason: `Name prefix "${code}" matched productivity ${prod.matchCode} (${prod.scopeName}) but UOM ${prod.uom} ≠ ${input.uom}. Refusing to apply.`,
        };
      }
      return {
        productivityEntryId: prod.id,
        divisionId: prod.divisionId,
        source: 'togal-prefix',
        confidence: 95,
        matchedCode: prod.matchCode,
        uomMismatch: false,
        reason: `Name prefix "${code}" → matchCode ${prod.matchCode} (${prod.scopeName}).`,
      };
    }
  }

  // --- Regra 3: Folder → Division (informational, no productivity) ---
  if (input.togalFolder && input.togalFolder.trim()) {
    const div = findDivisionByFolderName(input.togalFolder, refs.divisions);
    if (div) {
      return {
        productivityEntryId: null,
        divisionId: div.id,
        source: 'togal-folder',
        confidence: 70,
        matchedCode: null,
        uomMismatch: false,
        reason: `Folder "${input.togalFolder}" → division ${div.name}. No productivity matchCode found — caller should fall through to fuzzy/AI.`,
      };
    }
  }

  // --- Regra 4: Unresolved ---
  return {
    productivityEntryId: null,
    divisionId: null,
    source: 'unresolved',
    confidence: 0,
    matchedCode: null,
    uomMismatch: false,
    reason: 'No Togal ID, name prefix, or folder mapped to a productivity — caller falls through.',
  };
}
