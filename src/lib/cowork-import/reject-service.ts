import type { PrismaClient } from '@prisma/client';

/**
 * Discriminated result of an import REJECT operation.
 *
 * The route handler maps each kind to an HTTP status:
 *
 *   kind                    HTTP    What happened?
 *   ----                    ----    --------------
 *   success                 200     Import marked as rejected with reason
 *   import_not_found        404     EstimateImport id not in DB
 *   wrong_import_status     422     Status not in [previewed, failed]
 *   reason_too_short        400     rejectionReason < 10 chars
 */
export type RejectImportResult =
  | { kind: 'success'; importId: string }
  | { kind: 'import_not_found' }
  | { kind: 'wrong_import_status'; currentStatus: string }
  | { kind: 'reason_too_short'; minLength: number };

export type RejectImportInput = {
  importId: string;
  projectId: string;
  companyId: string;
  userId: string;
  rejectionReason: string;
};

const MIN_REASON_LENGTH = 10;

/**
 * Reject a pending EstimateImport.
 *
 * Valid initial states: 'previewed' or 'failed'. Already-applied or
 * already-rejected imports cannot be rejected again.
 *
 * Records who rejected, when, and the reason for audit trail.
 */
export async function rejectImport(
  prisma: PrismaClient,
  input: RejectImportInput,
): Promise<RejectImportResult> {
  // 1. Validate reason length
  if (input.rejectionReason.trim().length < MIN_REASON_LENGTH) {
    return {
      kind: 'reason_too_short',
      minLength: MIN_REASON_LENGTH,
    };
  }

  // 2. Load the import (scoped to tenant + project for IDOR safety)
  const importRow = await prisma.estimateImport.findFirst({
    where: {
      id: input.importId,
      companyId: input.companyId,
      projectId: input.projectId,
    },
    select: { id: true, status: true },
  });

  if (!importRow) {
    return { kind: 'import_not_found' };
  }

  if (importRow.status !== 'previewed' && importRow.status !== 'failed') {
    return {
      kind: 'wrong_import_status',
      currentStatus: importRow.status,
    };
  }

  // 3. Update
  await prisma.estimateImport.update({
    where: { id: importRow.id },
    data: {
      status: 'rejected',
      rejectedById: input.userId,
      rejectedAt: new Date(),
      rejectionReason: input.rejectionReason.trim(),
    },
  });

  return { kind: 'success', importId: importRow.id };
}
