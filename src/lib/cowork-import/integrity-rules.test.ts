import { describe, it, expect } from 'vitest';
import {
  validateIntegrity,
  checkMaterialCoverage,
  checkProductivityCoverage,
  checkHistogramProductivityBand,
  checkServiceCodeConsistency,
  checkAllowanceAmount,
  checkGeometryPlausibility,
  checkRecommendedScenarioExists,
} from './integrity-rules';
import { createMinimalValidImport, cloneFixture } from './test-fixtures';

describe('integrity-rules', () => {
  describe('happy path', () => {
    it('valid minimal import passes all 7 rules', () => {
      const json = createMinimalValidImport();
      const result = validateIntegrity(json);
      expect(result.passed).toBe(true);
      expect(result.blockers).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.rulesEvaluated).toBe(7);
    });
  });

  describe('Rule 1 — material coverage', () => {
    it('fails when M+L scope_item has no material', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.materials = []; // remove material for service_code S-01
      const violation = checkMaterialCoverage(json);
      expect(violation).not.toBeNull();
      expect(violation?.rule).toBe('MATERIAL_COVERAGE');
      expect(violation?.severity).toBe('BLOCKER');
    });

    it('passes when scope_item type is L only (no material needed)', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.scope_items[0].type = 'L'; // labor-only
      json.materials = []; // no material is OK
      const violation = checkMaterialCoverage(json);
      expect(violation).toBeNull();
    });
  });

  describe('Rule 2 — productivity coverage', () => {
    it('fails when M+L scope_item has no productivity', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.labor_productivity = [];
      const violation = checkProductivityCoverage(json);
      expect(violation).not.toBeNull();
      expect(violation?.rule).toBe('PRODUCTIVITY_COVERAGE');
      expect(violation?.severity).toBe('BLOCKER');
    });
  });

  describe('Rule 3 — histogram-productivity band', () => {
    it('fails (WARNING) when histogram total > 1.25× productivity total', () => {
      const json = cloneFixture(createMinimalValidImport());
      // productivity total_mh = 100; histogram = 200 (ratio 2.0)
      json.histogram = {
        rows: [
          {
            activity: 'test',
            headcount_by_week: [1, 1],
            total_mh: 200,
          },
        ],
      };
      const violation = checkHistogramProductivityBand(json);
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe('WARNING');
    });

    it('skips when histogram is absent', () => {
      const json = createMinimalValidImport();
      // no histogram (default in minimal fixture)
      const violation = checkHistogramProductivityBand(json);
      expect(violation).toBeNull();
    });

    it('skips when histogram.rows is empty array (F1 decision)', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.histogram = { rows: [] };
      const violation = checkHistogramProductivityBand(json);
      expect(violation).toBeNull();
    });

    it('skips when productivity total is 0', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.labor_productivity[0].total_mh = 0;
      json.histogram = {
        rows: [{ activity: 'x', headcount_by_week: [1], total_mh: 50 }],
      };
      const violation = checkHistogramProductivityBand(json);
      expect(violation).toBeNull();
    });
  });

  describe('Rule 4 — service_code consistency', () => {
    it('fails when takeoff references undeclared service_code', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.takeoff_items.push({
        takeoff_id: 'TK-X',
        service_code: 'S-99', // orphan
        description: 'orphan takeoff',
        quantity: 100,
        unit: 'SF',
        subtotal_role: 'LINE',
      });
      const violation = checkServiceCodeConsistency(json);
      expect(violation).not.toBeNull();
      expect(violation?.rule).toBe('SERVICE_CODE_CONSISTENCY');
      expect(violation?.severity).toBe('BLOCKER');
    });
  });

  describe('Rule 5 — allowance amount required', () => {
    it('fails (WARNING) when ALLOWANCE has null amount', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.scope_items.push({
        service_code: 'AL-01',
        category: 'ALLOWANCES',
        description: 'test allowance',
        status: 'ALLOWANCE',
        type: 'ALLOW',
        allowance_amount: null,
      });
      const violation = checkAllowanceAmount(json);
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe('WARNING');
    });

    it('passes when ALLOWANCE amount is 0 (F2 decision: TBD placeholder valid)', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.scope_items.push({
        service_code: 'AL-01',
        category: 'ALLOWANCES',
        description: 'TBD allowance',
        status: 'ALLOWANCE',
        type: 'ALLOW',
        allowance_amount: 0,
      });
      const violation = checkAllowanceAmount(json);
      expect(violation).toBeNull();
    });

    it('fails (WARNING) when ALLOWANCE has negative amount', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.scope_items.push({
        service_code: 'AL-01',
        category: 'ALLOWANCES',
        description: 'invalid',
        status: 'ALLOWANCE',
        type: 'ALLOW',
        allowance_amount: -100,
      });
      const violation = checkAllowanceAmount(json);
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe('WARNING');
    });
  });

  describe('Rule 6 — geometry plausibility', () => {
    it('fails (WARNING) when quantity diverges >5% from projected × slope', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.takeoff_items.push({
        takeoff_id: 'TK-G1',
        service_code: 'S-01',
        description: 'roof with bad quantity',
        geometry: { projected_area_sf: 1000, slope_factor: 1.2 },
        quantity: 1500, // expected = 1200, diff = 300 (25% off)
        unit: 'SF',
        subtotal_role: 'LINE',
      });
      const violation = checkGeometryPlausibility(json);
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe('WARNING');
    });

    it('fails (WARNING) when slope_factor=0 with quantity>0 (F3 decision)', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.takeoff_items.push({
        takeoff_id: 'TK-G2',
        service_code: 'S-01',
        description: 'pathological slope=0',
        geometry: { projected_area_sf: 1000, slope_factor: 0 },
        quantity: 1000, // expected = 0, diff = 1000 → Infinity ratio
        unit: 'SF',
        subtotal_role: 'LINE',
      });
      const violation = checkGeometryPlausibility(json);
      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe('WARNING');
    });

    it('skips when slope_factor is undefined', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.takeoff_items.push({
        takeoff_id: 'TK-G3',
        service_code: 'S-01',
        description: 'no slope',
        geometry: { projected_area_sf: 1000 },
        quantity: 1000,
        unit: 'SF',
        subtotal_role: 'LINE',
      });
      const violation = checkGeometryPlausibility(json);
      expect(violation).toBeNull();
    });
  });

  describe('Rule 7 — recommended scenario exists', () => {
    it('fails when summary references nonexistent scenario', () => {
      const json = cloneFixture(createMinimalValidImport());
      json.summary.recommended_scenario_code = 'Z_NONEXISTENT';
      const violation = checkRecommendedScenarioExists(json);
      expect(violation).not.toBeNull();
      expect(violation?.rule).toBe('RECOMMENDED_SCENARIO_EXISTS');
      expect(violation?.severity).toBe('BLOCKER');
    });
  });

  describe('validateIntegrity orchestrator', () => {
    it('aggregates blockers and warnings correctly', () => {
      const json = cloneFixture(createMinimalValidImport());
      // Inject 1 blocker (Rule 4 — orphan service_code)
      json.takeoff_items.push({
        takeoff_id: 'TK-X',
        service_code: 'S-99',
        description: 'orphan',
        quantity: 100,
        unit: 'SF',
        subtotal_role: 'LINE',
      });
      // Inject 1 warning (Rule 5 — null allowance)
      json.scope_items.push({
        service_code: 'AL-01',
        category: 'ALLOWANCES',
        description: 'bad',
        status: 'ALLOWANCE',
        type: 'ALLOW',
        allowance_amount: null,
      });

      const result = validateIntegrity(json);
      expect(result.passed).toBe(false);
      expect(result.blockers).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.blockers[0].rule).toBe('SERVICE_CODE_CONSISTENCY');
      expect(result.warnings[0].rule).toBe('ALLOWANCE_AMOUNT_REQUIRED');
      expect(result.rulesEvaluated).toBe(7);
    });
  });
});
