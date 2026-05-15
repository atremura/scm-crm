import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';

import { applyImport, type ApplyImportInput } from './apply-service';
import { createMinimalValidImport, cloneFixture } from './test-fixtures';

// ----- Prisma mock factory -----
type MockPrisma = {
  estimateImport: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  project: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  region: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  estimate: {
    create: ReturnType<typeof vi.fn>;
  };
  classification: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  estimateLine: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

function makePrismaMock(): MockPrisma {
  const prisma: MockPrisma = {
    estimateImport: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    project: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    region: {
      findFirst: vi.fn().mockResolvedValue({ id: 'region-default' }),
    },
    estimate: {
      create: vi.fn().mockResolvedValue({ id: 'estimate-new' }),
    },
    classification: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    estimateLine: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  // Make $transaction execute the callback with `prisma` as the tx client
  prisma.$transaction.mockImplementation(async (fn: (tx: MockPrisma) => Promise<unknown>) => {
    return await fn(prisma);
  });

  // Default classification.create returns sequential IDs
  let classCreateCounter = 0;
  prisma.classification.create.mockImplementation(async () => {
    classCreateCounter += 1;
    return { id: `class-${classCreateCounter}` };
  });

  // Default classification.update returns id from input (so apply can
  // continue without TypeError when an existing classification is matched).
  prisma.classification.update.mockImplementation(async (args: { where: { id: string } }) => ({
    id: args.where.id,
  }));

  // Default estimateLine.create returns sequential IDs
  let lineCounter = 0;
  prisma.estimateLine.create.mockImplementation(async () => {
    lineCounter += 1;
    return { id: `line-${lineCounter}` };
  });

  return prisma;
}

function makeInput(): ApplyImportInput {
  return {
    importId: 'import-1',
    projectId: 'project-1',
    companyId: 'company-1',
    userId: 'user-1',
  };
}

function makeValidPayloadJson() {
  const payload = cloneFixture(createMinimalValidImport());
  payload.estimate_meta.tenant_slug = 'awg';
  return payload;
}

function makeImportRow(
  overrides?: Partial<{
    status: string;
    rawPayload: unknown;
    previewSummary: unknown;
  }>,
) {
  return {
    id: 'import-1',
    status: 'previewed',
    rawPayload: makeValidPayloadJson(),
    previewSummary: { summary: { fromPreview: true }, warnings: [] },
    ...overrides,
  };
}

function makeProjectRow(
  overrides?: Partial<{
    status: string;
    estimate: { id: string } | null;
  }>,
) {
  return {
    id: 'project-1',
    status: 'active',
    estimate: null,
    ...overrides,
  };
}

describe('applyImport', () => {
  let prisma: MockPrisma;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrismaMock();
    // Default: happy path setup
    prisma.estimateImport.findFirst.mockResolvedValue(makeImportRow());
    prisma.project.findFirst.mockResolvedValue(makeProjectRow());
  });

  describe('happy path', () => {
    it('returns success with estimateId, classificationsCount, linesCount', async () => {
      const result = await applyImport(prisma as unknown as PrismaClient, makeInput());

      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.estimateId).toBe('estimate-new');
        expect(result.classificationsCount).toBeGreaterThan(0);
        expect(result.linesCount).toBeGreaterThan(0);
      }
    });

    it('creates Estimate with margins from recommended scenario', async () => {
      await applyImport(prisma as unknown as PrismaClient, makeInput());

      expect(prisma.estimate.create).toHaveBeenCalledTimes(1);
      const callArg = prisma.estimate.create.mock.calls[0][0];

      expect(callArg.data.regionId).toBe('region-default');
      expect(callArg.data.companyId).toBe('company-1');
      expect(callArg.data.projectId).toBe('project-1');
      expect(callArg.data.ownerId).toBe('user-1');
      expect(callArg.data.status).toBe('in_pricing');
    });

    it('transitions project status to estimate_accepted', async () => {
      await applyImport(prisma as unknown as PrismaClient, makeInput());

      expect(prisma.project.update).toHaveBeenCalledTimes(1);
      const updateArg = prisma.project.update.mock.calls[0][0];
      expect(updateArg.where.id).toBe('project-1');
      expect(updateArg.data.status).toBe('estimate_accepted');
      expect(updateArg.data.estimateAcceptedAt).toBeInstanceOf(Date);
    });

    it('merges new apply manifest into existing previewSummary', async () => {
      await applyImport(prisma as unknown as PrismaClient, makeInput());

      const importUpdate = prisma.estimateImport.update.mock.calls[0][0];
      const merged = importUpdate.data.previewSummary as Record<string, unknown>;

      // Preserved from preview
      expect(merged.summary).toEqual({ fromPreview: true });
      expect(merged.warnings).toEqual([]);

      // Added by apply
      expect(merged.applied).toBeDefined();
      const applied = merged.applied as Record<string, unknown>;
      expect(applied.estimateId).toBe('estimate-new');
      expect(applied.appliedById).toBe('user-1');
      expect(Array.isArray(applied.classificationIds)).toBe(true);
      expect(Array.isArray(applied.lineIds)).toBe(true);
    });

    it('updates EstimateImport status to applied', async () => {
      await applyImport(prisma as unknown as PrismaClient, makeInput());

      const importUpdate = prisma.estimateImport.update.mock.calls[0][0];
      expect(importUpdate.data.status).toBe('applied');
      expect(importUpdate.data.appliedById).toBe('user-1');
      expect(importUpdate.data.appliedAt).toBeInstanceOf(Date);
      expect(importUpdate.data.estimateId).toBe('estimate-new');
    });
  });

  describe('preconditions', () => {
    it('returns import_not_found when EstimateImport does not exist', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce(null);
      const result = await applyImport(prisma as unknown as PrismaClient, makeInput());
      expect(result.kind).toBe('import_not_found');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns wrong_import_status when status is not previewed (failed)', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce(makeImportRow({ status: 'failed' }));
      const result = await applyImport(prisma as unknown as PrismaClient, makeInput());
      expect(result.kind).toBe('wrong_import_status');
      if (result.kind === 'wrong_import_status') {
        expect(result.currentStatus).toBe('failed');
      }
    });

    it('returns wrong_import_status when status is applied (already applied)', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce(makeImportRow({ status: 'applied' }));
      const result = await applyImport(prisma as unknown as PrismaClient, makeInput());
      expect(result.kind).toBe('wrong_import_status');
    });

    it('returns estimate_exists when project already has an Estimate', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(
        makeProjectRow({ estimate: { id: 'estimate-existing' } }),
      );
      const result = await applyImport(prisma as unknown as PrismaClient, makeInput());
      expect(result.kind).toBe('estimate_exists');
      if (result.kind === 'estimate_exists') {
        expect(result.existingEstimateId).toBe('estimate-existing');
      }
    });

    it('returns wrong_project_status when project is archived', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(makeProjectRow({ status: 'archived' }));
      const result = await applyImport(prisma as unknown as PrismaClient, makeInput());
      expect(result.kind).toBe('wrong_project_status');
      if (result.kind === 'wrong_project_status') {
        expect(result.currentStatus).toBe('archived');
      }
    });

    it('returns wrong_project_status when project is estimate_accepted', async () => {
      prisma.project.findFirst.mockResolvedValueOnce(
        makeProjectRow({ status: 'estimate_accepted' }),
      );
      const result = await applyImport(prisma as unknown as PrismaClient, makeInput());
      expect(result.kind).toBe('wrong_project_status');
    });

    it('returns no_default_region when tenant has no default Region', async () => {
      prisma.region.findFirst.mockResolvedValueOnce(null);
      const result = await applyImport(prisma as unknown as PrismaClient, makeInput());
      expect(result.kind).toBe('no_default_region');
    });

    it('returns corrupt_payload when rawPayload no longer matches schema', async () => {
      prisma.estimateImport.findFirst.mockResolvedValueOnce(
        makeImportRow({ rawPayload: { broken: true } }),
      );
      const result = await applyImport(prisma as unknown as PrismaClient, makeInput());
      expect(result.kind).toBe('corrupt_payload');
      if (result.kind === 'corrupt_payload') {
        expect(result.details).toBeDefined();
      }
    });
  });

  describe('scope_item filtering', () => {
    it('skips scope_items with type NOTE', async () => {
      const payload = makeValidPayloadJson();
      // Add a NOTE item
      payload.scope_items.push({
        service_code: 'EX-01',
        category: 'EXCLUSIONS',
        description: 'Note item, should be skipped',
        status: 'BY_OTHERS',
        type: 'NOTE',
      });

      prisma.estimateImport.findFirst.mockResolvedValueOnce(makeImportRow({ rawPayload: payload }));

      await applyImport(prisma as unknown as PrismaClient, makeInput());

      // EstimateLine.create should NOT be called for EX-01
      const lineCalls = prisma.estimateLine.create.mock.calls;
      const allLineExternalIds = lineCalls.map((c) => c[0].data.externalId);
      expect(allLineExternalIds).not.toContain('EX-01');
    });

    it('skips scope_items with status BY_OTHERS', async () => {
      const payload = makeValidPayloadJson();
      payload.scope_items.push({
        service_code: 'EX-02',
        category: 'EXCLUSIONS',
        description: 'By others — should be skipped',
        status: 'BY_OTHERS',
        type: 'M+L',
      });

      prisma.estimateImport.findFirst.mockResolvedValueOnce(makeImportRow({ rawPayload: payload }));

      await applyImport(prisma as unknown as PrismaClient, makeInput());
      const allLineExternalIds = prisma.estimateLine.create.mock.calls.map(
        (c) => c[0].data.externalId,
      );
      expect(allLineExternalIds).not.toContain('EX-02');
    });

    it('creates special EstimateLine for ALLOWANCE scope_items', async () => {
      const payload = makeValidPayloadJson();
      payload.scope_items.push({
        service_code: 'AL-01',
        category: 'ALLOWANCES',
        description: 'Test allowance $5000',
        status: 'ALLOWANCE',
        type: 'ALLOW',
        allowance_amount: 5000,
      });

      prisma.estimateImport.findFirst.mockResolvedValueOnce(makeImportRow({ rawPayload: payload }));

      await applyImport(prisma as unknown as PrismaClient, makeInput());

      // Find the AL-01 line
      const lineCalls = prisma.estimateLine.create.mock.calls;
      const allowanceLine = lineCalls.find((c) => c[0].data.externalId === 'AL-01');
      expect(allowanceLine).toBeDefined();
      if (allowanceLine) {
        const data = allowanceLine[0].data;
        expect(data.quantity).toBe(1);
        expect(data.uom).toBe('LOT');
        expect(data.materialCostCents).toBe(5000 * 100);
        expect(data.laborCostCents).toBeNull();
        expect(data.source).toBe('cowork-import-allowance');
      }
    });
  });

  describe('aggregation logic', () => {
    it('uses MAX waste across takeoffs of same service_code', async () => {
      const payload = makeValidPayloadJson();
      // Minimal fixture has 0 takeoffs for S-01. Add two with different waste.
      payload.takeoff_items.push({
        takeoff_id: 'TK-S01-A',
        service_code: 'S-01',
        description: 'Takeoff A',
        quantity: 100,
        unit: 'SF',
        waste_pct: 0.05,
        subtotal_role: 'LINE',
      });
      payload.takeoff_items.push({
        takeoff_id: 'TK-S01-B',
        service_code: 'S-01',
        description: 'Takeoff B',
        quantity: 50,
        unit: 'SF',
        waste_pct: 0.2,
        subtotal_role: 'LINE',
      });

      prisma.estimateImport.findFirst.mockResolvedValueOnce(makeImportRow({ rawPayload: payload }));

      await applyImport(prisma as unknown as PrismaClient, makeInput());

      // Find S-01 line; its materialBreakdown should reflect MAX waste 20%
      const lineCalls = prisma.estimateLine.create.mock.calls;
      const s01Line = lineCalls.find((c) => c[0].data.externalId === 'S-01');
      expect(s01Line).toBeDefined();
      if (s01Line) {
        const breakdown = s01Line[0].data.materialBreakdown as Array<{
          wastePercent: number;
        }> | null;
        expect(breakdown).not.toBeNull();
        if (breakdown && breakdown.length > 0) {
          // Max(0.05, 0.20) * 100 = 20
          expect(breakdown[0].wastePercent).toBe(20);
        }
      }
    });

    it('aggregates takeoff quantities for same service_code', async () => {
      const payload = makeValidPayloadJson();
      payload.takeoff_items.push({
        takeoff_id: 'TK-S01-A',
        service_code: 'S-01',
        description: 'Takeoff A',
        quantity: 100,
        unit: 'SF',
        subtotal_role: 'LINE',
      });
      payload.takeoff_items.push({
        takeoff_id: 'TK-S01-B',
        service_code: 'S-01',
        description: 'Takeoff B',
        quantity: 250,
        unit: 'SF',
        subtotal_role: 'LINE',
      });

      prisma.estimateImport.findFirst.mockResolvedValueOnce(makeImportRow({ rawPayload: payload }));

      await applyImport(prisma as unknown as PrismaClient, makeInput());

      const lineCalls = prisma.estimateLine.create.mock.calls;
      const s01Line = lineCalls.find((c) => c[0].data.externalId === 'S-01');
      expect(s01Line).toBeDefined();
      if (s01Line) {
        expect(s01Line[0].data.quantity).toBe(100 + 250);
      }
    });
  });

  describe('consolidation by service_code', () => {
    it('consolidates multiple scope_items sharing the same service_code into ONE EstimateLine', async () => {
      const payload = makeValidPayloadJson();
      // Fixture has 1 scope_item S-01. Add 2 more sharing the same code.
      // (Real-world example: F-09 had 3 scope_items for Sill plates,
      // Blocking, Fireblocking — all under the same service_code.)
      payload.scope_items.push({
        service_code: 'S-01',
        category: 'SIDING SYSTEM',
        description: 'Test siding scope #2 — blocking',
        status: 'INCLUDED',
        type: 'M+L',
      });
      payload.scope_items.push({
        service_code: 'S-01',
        category: 'SIDING SYSTEM',
        description: 'Test siding scope #3 — fireblocking',
        status: 'INCLUDED',
        type: 'M+L',
      });

      prisma.estimateImport.findFirst.mockResolvedValueOnce(makeImportRow({ rawPayload: payload }));

      await applyImport(prisma as unknown as PrismaClient, makeInput());

      const lineCalls = prisma.estimateLine.create.mock.calls;
      // 1 line for 3 scope_items sharing S-01 (no duplication)
      expect(lineCalls.length).toBe(1);

      const lineData = lineCalls[0][0].data;
      expect(lineData.externalId).toBe('S-01');

      // Description joined with ' · ' separator
      expect(lineData.name).toContain(' · ');
      expect(lineData.name).toContain('Test siding scope #2');
      expect(lineData.name).toContain('Test siding scope #3');

      // Notes annotation
      expect(lineData.notes).toContain('Consolidated from 3 scope items');

      // Material cost from the ONE material row in the fixture (100 SF × $5 = $500 = 50_000 cents)
      // NOT tripled. If the old bug were present, this would be 150_000.
      expect(lineData.materialCostCents).toBe(50_000);

      // Classification upsert called ONCE per service_code, not per scope_item
      expect(prisma.classification.create).toHaveBeenCalledTimes(1);
    });

    it('warns and uses first takeoff when mixed UOMs in same service_code', async () => {
      const payload = makeValidPayloadJson();
      // Mix two takeoffs with incompatible UOMs (LF + EA)
      payload.takeoff_items.push({
        takeoff_id: 'TK-S01-LF',
        service_code: 'S-01',
        description: 'Linear takeoff',
        quantity: 1500,
        unit: 'LF',
        subtotal_role: 'LINE',
      });
      payload.takeoff_items.push({
        takeoff_id: 'TK-S01-EA',
        service_code: 'S-01',
        description: 'Count takeoff',
        quantity: 380,
        unit: 'EA',
        subtotal_role: 'LINE',
      });

      prisma.estimateImport.findFirst.mockResolvedValueOnce(makeImportRow({ rawPayload: payload }));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await applyImport(prisma as unknown as PrismaClient, makeInput());

      const lineCalls = prisma.estimateLine.create.mock.calls;
      const s01Line = lineCalls.find((c) => c[0].data.externalId === 'S-01');
      expect(s01Line).toBeDefined();
      if (s01Line) {
        // First takeoff wins (LF, 1500) — NOT 1500 + 380 = 1880
        expect(s01Line[0].data.quantity).toBe(1500);
        expect(s01Line[0].data.uom).toBe('LF');
      }
      expect(warnSpy).toHaveBeenCalled();
      const warnArg = warnSpy.mock.calls[0][0];
      expect(warnArg).toMatch(/mixed UOMs/i);

      warnSpy.mockRestore();
    });
  });

  describe('displayOrder', () => {
    it('assigns displayOrder in gaps of 10', async () => {
      await applyImport(prisma as unknown as PrismaClient, makeInput());

      const lineCalls = prisma.estimateLine.create.mock.calls;
      const orders = lineCalls.map((c) => c[0].data.displayOrder as number);
      // First line: 10, second: 20, third: 30, etc.
      orders.forEach((order, idx) => {
        expect(order).toBe((idx + 1) * 10);
      });
    });
  });

  describe('Classification upsert', () => {
    it('creates new Classification when none exists by externalId', async () => {
      prisma.classification.findFirst.mockResolvedValue(null);

      await applyImport(prisma as unknown as PrismaClient, makeInput());

      expect(prisma.classification.create).toHaveBeenCalled();
      expect(prisma.classification.update).not.toHaveBeenCalled();
    });

    it('updates existing Classification when found by externalId', async () => {
      prisma.classification.findFirst.mockResolvedValue({
        id: 'class-existing',
      });

      await applyImport(prisma as unknown as PrismaClient, makeInput());

      expect(prisma.classification.update).toHaveBeenCalled();
    });
  });
});
