import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import { previewImport, buildSummary, type ImportPreviewInput } from './import-service';
import { createMinimalValidImport, cloneFixture } from './test-fixtures';

// ----- Prisma mock factory -----
type MockPrisma = {
  estimateImport: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  company: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

function makePrismaMock(): MockPrisma {
  return {
    estimateImport: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'import-id-mock' }),
    },
    company: {
      findUnique: vi.fn().mockResolvedValue({ slug: 'awg' }),
    },
  };
}

function makeInput(rawPayload: object): ImportPreviewInput {
  return {
    projectId: 'project-1',
    companyId: 'company-1',
    userId: 'user-1',
    fileName: 'test.json',
    rawJsonString: JSON.stringify(rawPayload),
  };
}

function makeValidPayload() {
  const payload = cloneFixture(createMinimalValidImport());
  payload.estimate_meta.tenant_slug = 'awg';
  return payload;
}

describe('previewImport', () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = makePrismaMock();
  });

  describe('happy path', () => {
    it('returns success kind for a valid payload', async () => {
      const result = await previewImport(
        prisma as unknown as PrismaClient,
        makeInput(makeValidPayload()),
      );
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.importId).toBe('import-id-mock');
        expect(result.status).toBe('previewed');
        expect(result.warnings).toEqual([]);
        expect(result.summary.scopeItemsCount).toBeGreaterThan(0);
      }
    });

    it('persists EstimateImport with status="previewed"', async () => {
      await previewImport(prisma as unknown as PrismaClient, makeInput(makeValidPayload()));
      expect(prisma.estimateImport.create).toHaveBeenCalledTimes(1);
      const callArg = prisma.estimateImport.create.mock.calls[0][0];
      expect(callArg.data.status).toBe('previewed');
    });
  });

  describe('zod_failed', () => {
    it('returns zod_failed for malformed JSON missing required fields', async () => {
      const result = await previewImport(
        prisma as unknown as PrismaClient,
        makeInput({ broken: true }),
      );
      expect(result.kind).toBe('zod_failed');
    });

    it('does NOT persist EstimateImport when Zod fails', async () => {
      await previewImport(prisma as unknown as PrismaClient, makeInput({ broken: true }));
      expect(prisma.estimateImport.create).not.toHaveBeenCalled();
    });
  });

  describe('conflict', () => {
    it('returns conflict when EstimateImport with same fileHash exists', async () => {
      prisma.estimateImport.findUnique.mockResolvedValueOnce({
        id: 'existing-id',
        status: 'previewed',
      });

      const result = await previewImport(
        prisma as unknown as PrismaClient,
        makeInput(makeValidPayload()),
      );

      expect(result.kind).toBe('conflict');
      if (result.kind === 'conflict') {
        expect(result.existingImportId).toBe('existing-id');
        expect(result.existingStatus).toBe('previewed');
      }
      expect(prisma.estimateImport.create).not.toHaveBeenCalled();
    });
  });

  describe('tenant_not_found', () => {
    it('returns tenant_not_found when Company record is missing', async () => {
      prisma.company.findUnique.mockResolvedValueOnce(null);

      const result = await previewImport(
        prisma as unknown as PrismaClient,
        makeInput(makeValidPayload()),
      );

      expect(result.kind).toBe('tenant_not_found');
      expect(prisma.estimateImport.create).not.toHaveBeenCalled();
    });
  });

  describe('validation_failed', () => {
    it('returns validation_failed with TENANT_SLUG_MATCH blocker when slugs differ', async () => {
      const payload = makeValidPayload();
      payload.estimate_meta.tenant_slug = 'other-tenant';

      const result = await previewImport(prisma as unknown as PrismaClient, makeInput(payload));

      expect(result.kind).toBe('validation_failed');
      if (result.kind === 'validation_failed') {
        expect(result.status).toBe('failed');
        const ruleIds = result.blockers.map((b) => b.rule);
        expect(ruleIds).toContain('TENANT_SLUG_MATCH');
      }
    });

    it('returns validation_failed when payload tenant_slug is null', async () => {
      const payload = makeValidPayload();
      payload.estimate_meta.tenant_slug = null;

      const result = await previewImport(prisma as unknown as PrismaClient, makeInput(payload));

      expect(result.kind).toBe('validation_failed');
      if (result.kind === 'validation_failed') {
        const ruleIds = result.blockers.map((b) => b.rule);
        expect(ruleIds).toContain('TENANT_SLUG_MATCH');
      }
    });

    it('returns validation_failed with SERVICE_CODE_CONSISTENCY blocker', async () => {
      const payload = makeValidPayload();
      payload.takeoff_items.push({
        takeoff_id: 'TK-X',
        service_code: 'S-99', // orphan
        description: 'orphan takeoff',
        quantity: 100,
        unit: 'SF',
        subtotal_role: 'LINE',
      });

      const result = await previewImport(prisma as unknown as PrismaClient, makeInput(payload));

      expect(result.kind).toBe('validation_failed');
      if (result.kind === 'validation_failed') {
        const ruleIds = result.blockers.map((b) => b.rule);
        expect(ruleIds).toContain('SERVICE_CODE_CONSISTENCY');
      }
    });

    it('persists EstimateImport with status="failed" on validation failure', async () => {
      const payload = makeValidPayload();
      payload.estimate_meta.tenant_slug = 'other-tenant';

      await previewImport(prisma as unknown as PrismaClient, makeInput(payload));

      const callArg = prisma.estimateImport.create.mock.calls[0][0];
      expect(callArg.data.status).toBe('failed');
    });
  });

  describe('success with warnings', () => {
    it('returns success even when Rule 5 (allowance) warns', async () => {
      const payload = makeValidPayload();
      payload.scope_items.push({
        service_code: 'AL-01',
        category: 'ALLOWANCES',
        description: 'TBD allowance with negative amount',
        status: 'ALLOWANCE',
        type: 'ALLOW',
        allowance_amount: -100, // triggers WARNING
      });

      const result = await previewImport(prisma as unknown as PrismaClient, makeInput(payload));

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.warnings.length).toBeGreaterThan(0);
        const ruleIds = result.warnings.map((w) => w.rule);
        expect(ruleIds).toContain('ALLOWANCE_AMOUNT_REQUIRED');
      }
    });
  });
});

describe('buildSummary', () => {
  it('computes counts and identifiers from a valid payload', () => {
    const payload = createMinimalValidImport();
    payload.estimate_meta.tenant_slug = 'awg';
    const summary = buildSummary(payload);

    expect(summary.projectName).toBe(payload.estimate_meta.project_name);
    expect(summary.estimateType).toBe(payload.estimate_meta.estimate_type);
    expect(summary.scopeItemsCount).toBe(payload.scope_items.length);
    expect(summary.scenariosCount).toBe(payload.scenarios.length);
    expect(summary.recommendedScenarioCode).toBe(payload.summary.recommended_scenario_code);
    expect(summary.totalBidPrice).toBe(payload.summary.total_bid_price);
  });
});
