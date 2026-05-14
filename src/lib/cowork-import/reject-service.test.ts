import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import { rejectImport, type RejectImportInput } from './reject-service';

type MockPrisma = {
  estimateImport: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function makePrismaMock(): MockPrisma {
  return {
    estimateImport: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

function makeInput(overrides?: Partial<RejectImportInput>): RejectImportInput {
  return {
    importId: 'import-1',
    projectId: 'project-1',
    companyId: 'company-1',
    userId: 'user-1',
    rejectionReason: 'Customer wants a different scenario',
    ...overrides,
  };
}

describe('rejectImport', () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrismaMock();
  });

  describe('happy path', () => {
    it('rejects a previewed import successfully', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce({
        id: 'import-1',
        status: 'previewed',
      });

      const result = await rejectImport(prisma as unknown as PrismaClient, makeInput());

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.importId).toBe('import-1');
      }

      expect(prisma.estimateImport.update).toHaveBeenCalledTimes(1);
      const updateArg = prisma.estimateImport.update.mock.calls[0][0];
      expect(updateArg.data.status).toBe('rejected');
      expect(updateArg.data.rejectedById).toBe('user-1');
      expect(updateArg.data.rejectedAt).toBeInstanceOf(Date);
      expect(updateArg.data.rejectionReason).toBe('Customer wants a different scenario');
    });

    it('rejects a failed import successfully', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce({
        id: 'import-1',
        status: 'failed',
      });

      const result = await rejectImport(prisma as unknown as PrismaClient, makeInput());

      expect(result.kind).toBe('success');
    });

    it('trims rejection reason', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce({
        id: 'import-1',
        status: 'previewed',
      });

      await rejectImport(
        prisma as unknown as PrismaClient,
        makeInput({ rejectionReason: '   Need more time to review   ' }),
      );

      const updateArg = prisma.estimateImport.update.mock.calls[0][0];
      expect(updateArg.data.rejectionReason).toBe('Need more time to review');
    });
  });

  describe('validation errors', () => {
    it('returns reason_too_short when reason is < 10 chars', async () => {
      const result = await rejectImport(
        prisma as unknown as PrismaClient,
        makeInput({ rejectionReason: 'too short' }),
      );

      expect(result.kind).toBe('reason_too_short');
      if (result.kind === 'reason_too_short') {
        expect(result.minLength).toBe(10);
      }
      expect(prisma.estimateImport.findFirst).not.toHaveBeenCalled();
    });

    it('returns reason_too_short when reason is only whitespace', async () => {
      const result = await rejectImport(
        prisma as unknown as PrismaClient,
        makeInput({ rejectionReason: '          ' }),
      );

      expect(result.kind).toBe('reason_too_short');
    });

    it('treats exactly 10 chars as valid', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce({
        id: 'import-1',
        status: 'previewed',
      });

      const result = await rejectImport(
        prisma as unknown as PrismaClient,
        makeInput({ rejectionReason: '1234567890' }), // exactly 10
      );

      expect(result.kind).toBe('success');
    });
  });

  describe('preconditions', () => {
    it('returns import_not_found when EstimateImport does not exist', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce(null);

      const result = await rejectImport(prisma as unknown as PrismaClient, makeInput());

      expect(result.kind).toBe('import_not_found');
      expect(prisma.estimateImport.update).not.toHaveBeenCalled();
    });

    it('returns wrong_import_status when status is applied', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce({
        id: 'import-1',
        status: 'applied',
      });

      const result = await rejectImport(prisma as unknown as PrismaClient, makeInput());

      expect(result.kind).toBe('wrong_import_status');
      if (result.kind === 'wrong_import_status') {
        expect(result.currentStatus).toBe('applied');
      }
    });

    it('returns wrong_import_status when status is already rejected', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce({
        id: 'import-1',
        status: 'rejected',
      });

      const result = await rejectImport(prisma as unknown as PrismaClient, makeInput());

      expect(result.kind).toBe('wrong_import_status');
    });

    it('scopes findFirst by companyId and projectId (IDOR prevention)', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce({
        id: 'import-1',
        status: 'previewed',
      });

      await rejectImport(prisma as unknown as PrismaClient, makeInput());

      const findArg = prisma.estimateImport.findFirst.mock.calls[0][0];
      expect(findArg.where).toMatchObject({
        id: 'import-1',
        companyId: 'company-1',
        projectId: 'project-1',
      });
    });
  });
});
