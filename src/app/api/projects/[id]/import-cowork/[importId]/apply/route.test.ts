import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/permissions', () => ({
  requireAuth: vi.fn(),
  canDo: vi.fn(),
}));

vi.mock('@/lib/cowork-import', () => ({
  applyImport: vi.fn(),
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { requireAuth, canDo } from '@/lib/permissions';
import { applyImport } from '@/lib/cowork-import';

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedCanDo = vi.mocked(canDo);
const mockedProjectFindFirst = vi.mocked(prisma.project.findFirst);
const mockedApplyImport = vi.mocked(applyImport);

function makeCtx() {
  return {
    userId: 'user-1',
    email: 'a@b.com',
    name: 'Andre',
    role: 'Admin',
    companyId: 'company-1',
    companyName: 'AWG',
  };
}

const makeContext = (id = 'project-1', importId = 'import-1') => ({
  params: Promise.resolve({ id, importId }),
});

const makeReq = () => new NextRequest('http://localhost/api/x', { method: 'POST' });

describe('POST /api/projects/[id]/import-cowork/[importId]/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAuth.mockResolvedValue(makeCtx());
    mockedCanDo.mockResolvedValue(true);
    mockedProjectFindFirst.mockResolvedValue({ id: 'project-1' } as never);
    // Default to success
    mockedApplyImport.mockResolvedValue({
      kind: 'success',
      estimateId: 'estimate-1',
      classificationsCount: 5,
      linesCount: 5,
    });
  });

  describe('auth + permission', () => {
    it('returns 401 unauthenticated', async () => {
      mockedRequireAuth.mockResolvedValueOnce(null);
      const res = await POST(makeReq(), makeContext());
      expect(res.status).toBe(401);
    });

    it('returns 403 without estimate.edit', async () => {
      mockedCanDo.mockResolvedValueOnce(false);
      const res = await POST(makeReq(), makeContext());
      expect(res.status).toBe(403);
    });

    it('requires estimate.edit specifically (not estimate.view or create)', async () => {
      await POST(makeReq(), makeContext());
      const canDoArgs = mockedCanDo.mock.calls[0];
      expect(canDoArgs[1]).toBe('estimate');
      expect(canDoArgs[2]).toBe('edit');
    });
  });

  describe('project lookup', () => {
    it('returns 404 when project not in company', async () => {
      mockedProjectFindFirst.mockResolvedValueOnce(null);
      const res = await POST(makeReq(), makeContext('other'));
      expect(res.status).toBe(404);
    });
  });

  describe('result mapping', () => {
    it('returns 200 on success', async () => {
      const res = await POST(makeReq(), makeContext());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.estimateId).toBe('estimate-1');
      expect(body.classificationsCount).toBe(5);
      expect(body.linesCount).toBe(5);
    });

    it('returns 404 on import_not_found', async () => {
      mockedApplyImport.mockResolvedValueOnce({ kind: 'import_not_found' });
      const res = await POST(makeReq(), makeContext());
      expect(res.status).toBe(404);
    });

    it('returns 422 on wrong_import_status with current status', async () => {
      mockedApplyImport.mockResolvedValueOnce({
        kind: 'wrong_import_status',
        currentStatus: 'failed',
      });
      const res = await POST(makeReq(), makeContext());
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.currentStatus).toBe('failed');
    });

    it('returns 422 on wrong_project_status', async () => {
      mockedApplyImport.mockResolvedValueOnce({
        kind: 'wrong_project_status',
        currentStatus: 'archived',
      });
      const res = await POST(makeReq(), makeContext());
      expect(res.status).toBe(422);
    });

    it('returns 409 on estimate_exists with existingEstimateId', async () => {
      mockedApplyImport.mockResolvedValueOnce({
        kind: 'estimate_exists',
        existingEstimateId: 'estimate-old',
      });
      const res = await POST(makeReq(), makeContext());
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.existingEstimateId).toBe('estimate-old');
    });

    it('returns 400 on no_default_region', async () => {
      mockedApplyImport.mockResolvedValueOnce({ kind: 'no_default_region' });
      const res = await POST(makeReq(), makeContext());
      expect(res.status).toBe(400);
    });

    it('returns 500 on corrupt_payload', async () => {
      mockedApplyImport.mockResolvedValueOnce({
        kind: 'corrupt_payload',
        details: { formErrors: [], fieldErrors: {} },
      });
      const res = await POST(makeReq(), makeContext());
      expect(res.status).toBe(500);
    });
  });
});
