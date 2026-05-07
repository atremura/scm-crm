import type { CoworkImportV1 } from './schema';

/**
 * Test fixture helpers for cowork-import integrity rules tests.
 *
 * createMinimalValidImport() returns a CoworkImportV1 that passes all
 * 7 integrity rules. Tests that exercise individual rules clone this
 * and mutate specific fields to trigger violations.
 *
 * Strategy: keep the fixture small (1 scope_item, 1 material, etc.) so
 * each test only adds what it needs. Avoids accidental cross-rule
 * interference.
 */

/**
 * Minimal valid Cowork import payload.
 *
 * Shape:
 * - 1 scope_item (S-01, type 'M+L', INCLUDED)
 * - 1 material (S-01)
 * - 1 labor_productivity (S-01, total_mh: 100)
 * - 1 labor_rate (Carpenter)
 * - 1 scenario ('A_INHOUSE')
 * - 1 summary pointing at 'A_INHOUSE'
 * - No histogram, no allowances, no geometry, no risks, no review_flags
 *
 * Returns a fresh object every call (no shared mutable state).
 */
export function createMinimalValidImport(): CoworkImportV1 {
  return {
    schema_version: '1.0.0',
    estimate_meta: {
      project_name: 'Test Project',
      project_address: {
        line1: '123 Test St',
        city: 'Boston',
        state: 'MA',
        zip: '02101',
        country: 'US',
      },
      estimate_type: 'Roofing & Siding Systems',
      estimate_date: '2026-05-07',
      currency: 'USD',
      region: 'MA-Boston',
    },
    scope_items: [
      {
        service_code: 'S-01',
        category: 'SIDING SYSTEM',
        description: 'Test siding scope',
        status: 'INCLUDED',
        type: 'M+L',
      },
    ],
    takeoff_items: [],
    materials: [
      {
        material_id: 'M-S01',
        service_code: 'S-01',
        description: 'Test material',
        qty: 100,
        unit: 'SF',
        unit_cost: 5.0,
      },
    ],
    labor_rates: [
      {
        trade: 'Carpenter',
        base_wage_hr: 35,
        burden_pct: 0.45,
        markup_pct: 0.2,
        billed_hr: 60,
      },
    ],
    labor_productivity: [
      {
        activity_id: 'L-S01',
        service_code: 'S-01',
        activity: 'Test labor',
        quantity: 100,
        unit: 'SF',
        mh_per_unit: 0.06,
        total_mh: 100,
      },
    ],
    equipment: [],
    scenarios: [
      {
        scenario_code: 'A_INHOUSE',
        scenario_name: 'In-house',
        direct_costs: { subtotal: 10000 },
        markups: { markup_subtotal: 2000 },
        totals: { total_bid_price: 12000 },
        is_recommended: true,
      },
    ],
    summary: {
      recommended_scenario_code: 'A_INHOUSE',
      total_bid_price: 12000,
    },
  };
}

/**
 * Deep-clone a fixture so a test can mutate freely without affecting
 * other tests. JSON serialization is fine here because CoworkImportV1
 * is a pure data structure (no Dates, RegExps, functions, etc.).
 */
export function cloneFixture(base: CoworkImportV1): CoworkImportV1 {
  return JSON.parse(JSON.stringify(base)) as CoworkImportV1;
}
