import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    estimate: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    estimateImport: {
      deleteMany: vi.fn(),
    },
    project: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/permissions', () => ({
  requireAuth: vi.fn(),
  canDo: vi.fn(),
}));

import { DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { requireAuth, canDo } from '@/lib/permissions';

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedCanDo = vi.mocked(canDo);
const mockedFindFirst = vi.mocked(prisma.estimate.findFirst);
const mockedTransaction = vi.mocked(prisma.$transaction);
const mockedImportDeleteMany = vi.mocked(prisma.estimateImport.deleteMany);
const mockedEstimateDelete = vi.mocked(prisma.estimate.delete);
const mockedProjectUpdate = vi.mocked(prisma.project.update);

function makeCtx() {
  return {
    userId: 'user-1',
    email: 'a@b.com',
    name: 'Andre',
    role: 'Admin',
    companyId: 'company-1',
    companyName: 'JMO',
  };
}

const makeContext = (id = 'est-1') => ({
  params: Promise.resolve({ id }),
});

const makeReq = () => new NextRequest('http://localhost/api/estimates/est-1', { method: 'DELETE' });

describe('DELETE /api/estimates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAuth.mockResolvedValue(makeCtx());
    mockedCanDo.mockResolvedValue(true);
    // Default $transaction implementation: runs the callback with the same
    // prisma mock so transactional calls hit the same mocked methods.
    mockedTransaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    mockedImportDeleteMany.mockResolvedValue({ count: 0 });
    mockedEstimateDelete.mockResolvedValue({} as never);
    mockedProjectUpdate.mockResolvedValue({} as never);
  });

  describe('happy path', () => {
    it('deletes estimate, cascades EstimateImports, reverts project, returns 200', async () => {
      mockedFindFirst.mockResolvedValueOnce({
        id: 'est-1',
        projectId: 'proj-1',
      } as never);
      mockedImportDeleteMany.mockResolvedValueOnce({ count: 2 });

      const res = await DELETE(makeReq(), makeContext('est-1'));

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, projectId: 'proj-1' });

      // EstimateImports deleted before Estimate
      expect(mockedImportDeleteMany).toHaveBeenCalledWith({
        where: { estimateId: 'est-1' },
      });

      // Estimate deleted
      expect(mockedEstimateDelete).toHaveBeenCalledWith({
        where: { id: 'est-1' },
      });

      // Project reverted
      expect(mockedProjectUpdate).toHaveBeenCalledWith({
        where: { id: 'proj-1' },
        data: { status: 'active', estimateAcceptedAt: null },
      });
    });
  });

  describe('IDOR / not found', () => {
    it('returns 404 when estimate not in user company', async () => {
      // findFirst scoped by companyId returns null when estimate belongs
      // to a different company — IDOR protection.
      mockedFindFirst.mockResolvedValueOnce(null);

      const res = await DELETE(makeReq(), makeContext('est-other'));

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Estimate not found');

      // No transaction should have run
      expect(mockedTransaction).not.toHaveBeenCalled();
      expect(mockedEstimateDelete).not.toHaveBeenCalled();
    });

    it('scopes lookup by companyId in findFirst (IDOR prevention)', async () => {
      mockedFindFirst.mockResolvedValueOnce({
        id: 'est-1',
        projectId: 'proj-1',
      } as never);

      await DELETE(makeReq(), makeContext('est-1'));

      const findArgs = mockedFindFirst.mock.calls[0][0];
      expect(findArgs?.where).toMatchObject({
        id: 'est-1',
        companyId: 'company-1',
      });
    });
  });

  describe('auth + permission', () => {
    it('returns 401 when not authenticated', async () => {
      mockedRequireAuth.mockResolvedValueOnce(null);
      const res = await DELETE(makeReq(), makeContext());
      expect(res.status).toBe(401);
    });

    it('returns 403 without estimate.delete permission', async () => {
      mockedCanDo.mockResolvedValueOnce(false);
      const res = await DELETE(makeReq(), makeContext());
      expect(res.status).toBe(403);
    });

    it('requires estimate.delete specifically', async () => {
      mockedFindFirst.mockResolvedValueOnce({
        id: 'est-1',
        projectId: 'proj-1',
      } as never);
      await DELETE(makeReq(), makeContext());

      const args = mockedCanDo.mock.calls[0];
      expect(args[1]).toBe('estimate');
      expect(args[2]).toBe('delete');
    });
  });

  describe('cascade with linked imports', () => {
    it('deletes linked EstimateImports even when their count > 0', async () => {
      mockedFindFirst.mockResolvedValueOnce({
        id: 'est-with-imports',
        projectId: 'proj-1',
      } as never);
      mockedImportDeleteMany.mockResolvedValueOnce({ count: 3 });

      const res = await DELETE(makeReq(), makeContext('est-with-imports'));

      expect(res.status).toBe(200);
      // deleteMany scoped to this estimate's imports
      expect(mockedImportDeleteMany).toHaveBeenCalledWith({
        where: { estimateId: 'est-with-imports' },
      });
    });
  });
});
