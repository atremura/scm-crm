import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { findFirst: vi.fn() },
    estimateImport: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/permissions', () => ({
  requireAuth: vi.fn(),
  canDo: vi.fn(),
}));

import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { requireAuth, canDo } from '@/lib/permissions';

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedCanDo = vi.mocked(canDo);
const mockedProjectFindFirst = vi.mocked(prisma.project.findFirst);
const mockedImportFindFirst = vi.mocked(prisma.estimateImport.findFirst);

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

describe('GET /api/projects/[id]/import-cowork/[importId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAuth.mockResolvedValue(makeCtx());
    mockedCanDo.mockResolvedValue(true);
    mockedProjectFindFirst.mockResolvedValue({ id: 'project-1' } as never);
    mockedImportFindFirst.mockResolvedValue({
      id: 'import-1',
      status: 'previewed',
      rawPayload: { schema_version: '1.0.0' },
    } as never);
  });

  it('returns 401 when not authenticated', async () => {
    mockedRequireAuth.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/x');
    const res = await GET(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 403 without estimate.view permission', async () => {
    mockedCanDo.mockResolvedValueOnce(false);
    const req = new NextRequest('http://localhost/api/x');
    const res = await GET(req, makeContext());
    expect(res.status).toBe(403);
  });

  it('returns 404 when project not in user company', async () => {
    mockedProjectFindFirst.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/x');
    const res = await GET(req, makeContext());
    expect(res.status).toBe(404);
  });

  it('returns 404 when import not found in project', async () => {
    mockedImportFindFirst.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/x');
    const res = await GET(req, makeContext());
    expect(res.status).toBe(404);
  });

  it('returns 200 with full import including rawPayload', async () => {
    const req = new NextRequest('http://localhost/api/x');
    const res = await GET(req, makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.import.id).toBe('import-1');
    expect(body.import.rawPayload).toBeDefined();
  });

  it('scopes import lookup by companyId AND projectId (IDOR)', async () => {
    const req = new NextRequest('http://localhost/api/x');
    await GET(req, makeContext('project-1', 'import-1'));
    const findArgs = mockedImportFindFirst.mock.calls[0][0];
    expect(findArgs?.where).toMatchObject({
      id: 'import-1',
      projectId: 'project-1',
      companyId: 'company-1',
    });
  });
});
