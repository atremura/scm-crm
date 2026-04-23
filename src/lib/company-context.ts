import { auth } from '@/auth';

/**
 * Current user's company ID from the session. Null if not authenticated
 * or session is missing the companyId claim.
 */
export async function getCurrentCompanyId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { companyId?: string } | undefined)?.companyId ?? null;
}

/**
 * Throws if not authenticated. Use in API routes where authentication is
 * required and the companyId must be known before any DB query runs.
 */
export async function requireCompanyId(): Promise<string> {
  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    throw new Error('Unauthorized: no company context');
  }
  return companyId;
}
