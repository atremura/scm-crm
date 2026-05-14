import type { IntegrityViolation } from './integrity-rules';

/**
 * Rule 8 — tenant_slug match.
 *
 * Validates that the payload was drafted for the user's tenant.
 * This is a BLOCKER: importing a payload from another tenant is
 * a security boundary violation, not a data quality issue.
 *
 * Defined in docs/cowork-import-schema.md section 4, rule 8.
 *
 * Unlike the 7 rules in integrity-rules.ts (which are pure functions
 * of the payload alone), Rule 8 requires session context — the
 * caller's tenant slug. It lives in this separate module to keep
 * integrity-rules.ts free of any auth/session coupling.
 *
 * @param payloadTenantSlug - The tenant_slug from estimate_meta.
 *                            May be null if payload was generated for
 *                            an unknown/single-tenant Cowork session.
 * @param sessionTenantSlug - The slug of the Company that owns the
 *                            current session. Required (never null).
 * @returns BLOCKER violation if mismatch, null if match.
 */
export function checkTenantSlugMatch(
  payloadTenantSlug: string | null | undefined,
  sessionTenantSlug: string,
): IntegrityViolation | null {
  // Null payload tenant_slug is a soft case: payload was drafted for
  // unknown tenant. We reject it as a precaution — the importer
  // should never accept tenant-ambiguous payloads.
  if (payloadTenantSlug === null || payloadTenantSlug === undefined) {
    return {
      rule: 'TENANT_SLUG_MATCH' as const,
      severity: 'BLOCKER',
      message: 'Payload tenant_slug is missing. Cowork must mark the target tenant before export.',
      context: {
        payloadTenantSlug: null,
        sessionTenantSlug,
      },
    };
  }

  if (payloadTenantSlug !== sessionTenantSlug) {
    return {
      rule: 'TENANT_SLUG_MATCH' as const,
      severity: 'BLOCKER',
      message: `Payload tenant_slug "${payloadTenantSlug}" does not match your tenant "${sessionTenantSlug}".`,
      context: {
        payloadTenantSlug,
        sessionTenantSlug,
      },
    };
  }

  return null;
}
