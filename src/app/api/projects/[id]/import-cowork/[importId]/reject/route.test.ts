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
  rejectImport: vi.fn(),
}));

import { POST } from './route';
import { prisma } from '@/lib/prisma';
import { requireAuth, canDo } from '@/lib/permissions';
import { rejectImport } from '@/lib/cowork-import';

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedCanDo = vi.mocked(canDo);
const mockedProjectFindFirst = vi.mocked(prisma.project.findFirst);
const mockedRejectImport = vi.mocked(rejectImport);

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

const makeReq = (body: unknown = { rejectionReason: 'Customer wants different scenario' }) =>
  new NextRequest('http://localhost/api/x', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('POST /api/projects/[id]/import-cowork/[importId]/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAuth.mockResolvedValue(makeCtx());
    mockedCanDo.mockResolvedValue(true);
    mockedProjectFindFirst.mockResolvedValue({ id: 'project-1' } as never);
    mockedRejectImport.mockResolvedValue({
      kind: 'success',
      importId: 'import-1',
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
  });

  describe('body parsing', () => {
    it('returns 400 on invalid JSON body', async () => {
      const req = new NextRequest('http://localhost/api/x', {
        method: 'POST',
        body: 'not json{{{',
        headers: { 'content-type': 'application/json' },
      });
      const res = await POST(req, makeContext());
      expect(res.status).toBe(400);
    });

    it('returns 400 when rejectionReason is not a string', async () => {
      const res = await POST(makeReq({ rejectionReason: 12345 }), makeContext());
      expect(res.status).toBe(400);
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
      expect(body.importId).toBe('import-1');
      expect(body.status).toBe('rejected');
    });

    it('returns 404 on import_not_found', async () => {
      mockedRejectImport.mockResolvedValueOnce({ kind: 'import_not_found' });
      const res = await POST(makeReq(), makeContext());
      expect(res.status).toBe(404);
    });

    it('returns 422 on wrong_import_status with current status', async () => {
      mockedRejectImport.mockResolvedValueOnce({
        kind: 'wrong_import_status',
        currentStatus: 'applied',
      });
      const res = await POST(makeReq(), makeContext());
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.currentStatus).toBe('applied');
    });

    it('returns 400 on reason_too_short with minLength', async () => {
      mockedRejectImport.mockResolvedValueOnce({
        kind: 'reason_too_short',
        minLength: 10,
      });
      const res = await POST(makeReq({ rejectionReason: 'short' }), makeContext());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.minLength).toBe(10);
    });
  });

  describe('input forwarding', () => {
    it('passes rejectionReason to service', async () => {
      await POST(
        makeReq({
          rejectionReason: 'Detailed reason of more than 10 characters',
        }),
        makeContext(),
      );
      const serviceCall = mockedRejectImport.mock.calls[0][1];
      expect(serviceCall.rejectionReason).toBe('Detailed reason of more than 10 characters');
    });
  });
});
