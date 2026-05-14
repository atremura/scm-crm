import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies BEFORE importing the route handler.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/permissions', () => ({
  requireAuth: vi.fn(),
  canDo: vi.fn(),
}));

vi.mock('@/lib/cowork-import', () => ({
  previewImport: vi.fn(),
}));

// Imports AFTER mocks so they pick up the mocked versions.
import { POST, GET } from './route';
import { prisma } from '@/lib/prisma';
import { requireAuth, canDo } from '@/lib/permissions';
import { previewImport } from '@/lib/cowork-import';

const mockedRequireAuth = vi.mocked(requireAuth);
const mockedCanDo = vi.mocked(canDo);
const mockedPreviewImport = vi.mocked(previewImport);
const mockedProjectFindFirst = vi.mocked(prisma.project.findFirst);

function makeAuthCtx() {
  return {
    userId: 'user-1',
    email: 'andre@example.com',
    name: 'Andre',
    role: 'Admin',
    companyId: 'company-1',
    companyName: 'AWG',
  };
}

function makeRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/projects/p1/import-cowork', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const makeContext = (id = 'project-1') => ({
  params: Promise.resolve({ id }),
});

describe('POST /api/projects/[id]/import-cowork', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default happy path setup; individual tests override as needed.
    mockedRequireAuth.mockResolvedValue(makeAuthCtx());
    mockedCanDo.mockResolvedValue(true);
    mockedProjectFindFirst.mockResolvedValue({ id: 'project-1' } as never);
    // Default previewImport result so tests that don't care about the
    // service outcome (e.g., body-validation, project-scoping) still
    // produce a defined result when the handler reaches step 8.
    mockedPreviewImport.mockResolvedValue({
      kind: 'success',
      importId: 'default-import-id',
      status: 'previewed',
      summary: {
        projectName: 'default',
        estimateType: 'default',
        scopeItemsCount: 0,
        takeoffItemsCount: 0,
        materialsCount: 0,
        laborProductivityCount: 0,
        scenariosCount: 0,
        recommendedScenarioCode: 'A',
        totalBidPrice: 0,
      },
      warnings: [],
    });
  });

  describe('auth + permission', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockedRequireAuth.mockResolvedValueOnce(null);
      const res = await POST(makeRequest('{}'), makeContext());
      expect(res.status).toBe(401);
    });

    it('returns 403 when user lacks estimate.create permission', async () => {
      mockedCanDo.mockResolvedValueOnce(false);
      const res = await POST(makeRequest('{}'), makeContext());
      expect(res.status).toBe(403);
    });
  });

  describe('project lookup', () => {
    it('returns 404 when project does not belong to user company', async () => {
      mockedProjectFindFirst.mockResolvedValueOnce(null);
      const res = await POST(makeRequest('{}'), makeContext('other-project'));
      expect(res.status).toBe(404);
    });

    it('scopes project lookup by companyId (prevents IDOR)', async () => {
      await POST(makeRequest('{}'), makeContext('project-1'));
      const callArgs = mockedProjectFindFirst.mock.calls[0][0];
      expect(callArgs?.where).toMatchObject({
        id: 'project-1',
        companyId: 'company-1',
      });
    });
  });

  describe('body validation', () => {
    it('returns 400 when body is empty', async () => {
      const res = await POST(makeRequest(''), makeContext());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Empty');
    });

    it('returns 400 when body is not valid JSON', async () => {
      const res = await POST(makeRequest('not json {{{'), makeContext());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid JSON');
    });

    it('returns 413 when body exceeds MAX_BODY_BYTES', async () => {
      const oversized = 'x'.repeat(1_048_577); // 1 MiB + 1
      const res = await POST(makeRequest(oversized), makeContext());
      expect(res.status).toBe(413);
    });
  });

  describe('service result mapping', () => {
    it('returns 200 with summary on success', async () => {
      mockedPreviewImport.mockResolvedValueOnce({
        kind: 'success',
        importId: 'import-1',
        status: 'previewed',
        summary: {
          projectName: 'Test',
          estimateType: 'Siding',
          scopeItemsCount: 5,
          takeoffItemsCount: 3,
          materialsCount: 4,
          laborProductivityCount: 2,
          scenariosCount: 1,
          recommendedScenarioCode: 'A',
          totalBidPrice: 12345,
        },
        warnings: [],
      });

      const res = await POST(makeRequest('{"any":"json"}'), makeContext());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.importId).toBe('import-1');
      expect(body.status).toBe('previewed');
      expect(body.summary.totalBidPrice).toBe(12345);
    });

    it('returns 422 on validation_failed with blockers', async () => {
      mockedPreviewImport.mockResolvedValueOnce({
        kind: 'validation_failed',
        importId: 'import-2',
        status: 'failed',
        blockers: [
          {
            rule: 'MATERIAL_COVERAGE',
            severity: 'BLOCKER',
            message: 'missing materials',
            context: {},
          },
        ],
        warnings: [],
      });

      const res = await POST(makeRequest('{"any":"json"}'), makeContext());
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.importId).toBe('import-2');
      expect(body.blockers).toHaveLength(1);
    });

    it('returns 400 on zod_failed', async () => {
      mockedPreviewImport.mockResolvedValueOnce({
        kind: 'zod_failed',
        zodErrors: { formErrors: [], fieldErrors: {} },
      });

      const res = await POST(makeRequest('{"bad":"shape"}'), makeContext());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.zodErrors).toBeDefined();
    });

    it('returns 409 on conflict with existing import reference', async () => {
      mockedPreviewImport.mockResolvedValueOnce({
        kind: 'conflict',
        existingImportId: 'existing-1',
        existingStatus: 'previewed',
      });

      const res = await POST(makeRequest('{"any":"json"}'), makeContext());
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.existingImportId).toBe('existing-1');
    });

    it('returns 500 on tenant_not_found', async () => {
      mockedPreviewImport.mockResolvedValueOnce({
        kind: 'tenant_not_found',
        companyId: 'company-1',
      });

      const res = await POST(makeRequest('{"any":"json"}'), makeContext());
      expect(res.status).toBe(500);
    });
  });

  describe('fileName handling', () => {
    it('uses x-file-name header when provided', async () => {
      mockedPreviewImport.mockResolvedValueOnce({
        kind: 'success',
        importId: 'i',
        status: 'previewed',
        summary: {
          projectName: 'p',
          estimateType: 't',
          scopeItemsCount: 1,
          takeoffItemsCount: 0,
          materialsCount: 1,
          laborProductivityCount: 1,
          scenariosCount: 1,
          recommendedScenarioCode: 'A',
          totalBidPrice: 0,
        },
        warnings: [],
      });

      await POST(makeRequest('{"any":"json"}', { 'x-file-name': 'avalon.json' }), makeContext());

      const serviceCall = mockedPreviewImport.mock.calls[0][1];
      expect(serviceCall.fileName).toBe('avalon.json');
    });

    it('defaults fileName to import.json when header absent', async () => {
      mockedPreviewImport.mockResolvedValueOnce({
        kind: 'success',
        importId: 'i',
        status: 'previewed',
        summary: {
          projectName: 'p',
          estimateType: 't',
          scopeItemsCount: 1,
          takeoffItemsCount: 0,
          materialsCount: 1,
          laborProductivityCount: 1,
          scenariosCount: 1,
          recommendedScenarioCode: 'A',
          totalBidPrice: 0,
        },
        warnings: [],
      });

      await POST(makeRequest('{"any":"json"}'), makeContext());

      const serviceCall = mockedPreviewImport.mock.calls[0][1];
      expect(serviceCall.fileName).toBe('import.json');
    });
  });
});

describe('GET /api/projects/[id]/import-cowork', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAuth.mockResolvedValue(makeAuthCtx());
    mockedCanDo.mockResolvedValue(true);
    mockedProjectFindFirst.mockResolvedValue({ id: 'project-1' } as never);
  });

  it('returns 401 when not authenticated', async () => {
    mockedRequireAuth.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/projects/p1/import-cowork');
    const res = await GET(req, makeContext());
    expect(res.status).toBe(401);
  });

  it('returns 403 when user lacks estimate.view permission', async () => {
    mockedCanDo.mockResolvedValueOnce(false);
    const req = new NextRequest('http://localhost/api/projects/p1/import-cowork');
    const res = await GET(req, makeContext());
    expect(res.status).toBe(403);
  });

  it('returns 404 when project not found', async () => {
    mockedProjectFindFirst.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/projects/p1/import-cowork');
    const res = await GET(req, makeContext('other-project'));
    expect(res.status).toBe(404);
  });
});
