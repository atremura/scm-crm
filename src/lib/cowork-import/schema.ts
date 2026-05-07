// src/lib/cowork-import/schema.ts
import { z } from 'zod';

/**
 * Zod schemas mirroring docs/cowork-import.schema.json v1.0.0.
 *
 * Used by the import-cowork endpoint to validate incoming payloads
 * BEFORE running the integrity rules (which check semantic consistency
 * beyond structural schema validation).
 *
 * Keep in sync with cowork-import.schema.json. If Cowork bumps to
 * v1.1.0 (additive only), extend these schemas. If v2.0.0 (breaking),
 * create schema-v2.ts and dispatch by schema_version.
 */

// Reusable confidence sub-schema
export const ConfidenceSchema = z.object({
  level: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  score: z.number().min(0).max(1).optional(),
  source: z
    .enum([
      'DRAWINGS',
      'SPECS',
      'PRICE_BOOK',
      'PRODUCTIVITY_BOOK',
      'RSMEANS',
      'VENDOR_QUOTE',
      'INFERRED',
      'ASSUMED',
    ])
    .optional(),
  notes: z.string().optional(),
});

const ProjectAddressSchema = z.object({
  line1: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string().optional().default('US'),
});

const EstimateMetaSchema = z.object({
  tenant_slug: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  bid_id: z.string().nullable().optional(),
  project_name: z.string(),
  project_address: ProjectAddressSchema,
  owner_gc: z.string().optional(),
  designer: z.string().optional(),
  bid_set_date: z.string().optional(),
  revision: z.string().optional(),
  estimate_type: z.string(),
  estimator: z.string().optional(),
  estimate_date: z.string(),
  currency: z.string().default('USD'),
  region: z.string(),
  design_codes: z.array(z.string()).optional(),
  building_type: z.string().optional(),
  areas: z
    .object({
      finished_sf: z.number().min(0).optional(),
      garage_sf: z.number().min(0).optional(),
      porch_deck_sf: z.number().min(0).optional(),
      wall_gross_sf: z.number().min(0).optional(),
      footprint_sf: z.number().min(0).optional(),
      breakdown_by_floor: z
        .array(z.object({ level: z.string(), area_sf: z.number().min(0) }))
        .optional(),
    })
    .optional(),
  geometry_notes: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

const ScopeItemSchema = z.object({
  service_code: z.string().regex(/^[A-Z]{1,3}-[0-9]{2,3}$/),
  service_id: z.string().nullable().optional(),
  category: z.string(),
  description: z.string(),
  status: z.enum(['INCLUDED', 'EXCLUDED', 'ALLOWANCE', 'ALTERNATE', 'BY_OWNER', 'BY_OTHERS']),
  type: z.enum(['M', 'L', 'M+L', 'EQ', 'SUB', 'ALLOW', 'NOTE']),
  allowance_amount: z.number().nullable().optional(),
  notes: z.string().optional(),
  ai_confidence: ConfidenceSchema.optional(),
});

const TakeoffItemSchema = z.object({
  takeoff_id: z.string(),
  service_code: z.string(),
  description: z.string(),
  geometry: z
    .object({
      length_ft: z.number().optional(),
      width_ft: z.number().optional(),
      height_ft: z.number().optional(),
      projected_area_sf: z.number().optional(),
      pitch: z.string().optional(),
      slope_factor: z.number().optional(),
    })
    .optional(),
  quantity: z.number(),
  unit: z.enum([
    'SF',
    'LF',
    'SQ',
    'EA',
    'CY',
    'BF',
    'TON',
    'LB',
    'GAL',
    'BOX',
    'ROLL',
    'BUNDLE',
    'PC',
    'LOT',
    '100LF',
    '100SF',
    'MBF',
  ]),
  waste_pct: z.number().min(0).max(1).optional(),
  order_quantity: z.number().optional(),
  subtotal_role: z.enum(['LINE', 'SUBTOTAL', 'TOTAL']).optional().default('LINE'),
  notes: z.string().optional(),
  ai_confidence: ConfidenceSchema.optional(),
});

const MaterialSchema = z.object({
  material_id: z.string(),
  service_code: z.string(),
  description: z.string(),
  spec: z.string().optional(),
  qty: z.number().min(0),
  unit: z.string(),
  unit_cost: z.number().min(0),
  subtotal: z.number().optional(),
  tax_freight_pct: z.number().min(0).max(1).optional(),
  tax_freight_amount: z.number().min(0).optional(),
  total: z.number().optional(),
  vendor: z.string().optional(),
  vendor_quote_id: z.string().nullable().optional(),
  price_source: z
    .enum(['VENDOR_QUOTE', 'PRICE_BOOK', 'RSMEANS', 'AI_ESTIMATE', 'HISTORICAL'])
    .optional(),
  lead_time_days: z.number().int().min(0).nullable().optional(),
  notes: z.string().optional(),
  ai_confidence: ConfidenceSchema.optional(),
});

const LaborRateSchema = z.object({
  trade_code: z.string().optional(),
  trade: z.string(),
  base_wage_hr: z.number().min(0),
  burden_pct: z.number().min(0).max(2),
  burdened_hr: z.number().min(0).optional(),
  markup_pct: z.number().min(0).max(2),
  billed_hr: z.number().min(0),
  notes: z.string().optional(),
});

const LaborProductivitySchema = z.object({
  activity_id: z.string(),
  service_code: z.string(),
  activity: z.string(),
  quantity: z.number().min(0),
  unit: z.string(),
  mh_per_unit: z.number().min(0),
  total_mh: z.number().min(0).optional(),
  crew_size: z.number().int().min(1).optional(),
  crew_composition: z
    .array(z.object({ trade_code: z.string(), count: z.number().int().min(1) }))
    .optional(),
  crew_days: z.number().min(0).optional(),
  productivity_source: z
    .enum(['AWG_HISTORICAL', 'RSMEANS', 'AI_ESTIMATE', 'INDUSTRY_AVG'])
    .optional(),
  notes: z.string().optional(),
  ai_confidence: ConfidenceSchema.optional(),
});

const EquipmentSchema = z.object({
  equipment_id: z.string(),
  description: z.string(),
  category: z
    .enum(['ACCESS', 'LIFT', 'DELIVERY', 'DEBRIS', 'FACILITY', 'TOOL', 'PPE', 'PM', 'OTHER'])
    .optional(),
  qty: z.number().min(0),
  unit: z.string(),
  duration_wk: z.number().min(0).nullable().optional(),
  rate: z.number().min(0),
  rate_basis: z.enum(['WEEKLY', 'DAILY', 'HOURLY', 'LUMP', 'PER_HAUL', 'PER_DROP']).optional(),
  total: z.number().min(0),
  vendor: z.string().optional(),
  notes: z.string().optional(),
});

const ScenarioSchema = z.object({
  scenario_code: z.string(),
  scenario_name: z.string(),
  direct_costs: z.object({
    material: z.number().optional(),
    labor: z.number().optional(),
    subcontract: z.number().optional(),
    equipment: z.number().optional(),
    subtotal: z.number(),
  }),
  markups: z.object({
    general_conditions_pct: z.number().optional(),
    contingency_pct: z.number().optional(),
    bond_insurance_pct: z.number().optional(),
    overhead_pct: z.number().optional(),
    profit_pct: z.number().optional(),
    markup_subtotal: z.number(),
  }),
  totals: z.object({
    total_bid_price: z.number(),
    price_per_sf_finished: z.number().optional(),
    schedule_weeks: z.number().int().optional(),
  }),
  pros: z.array(z.string()).optional(),
  cons: z.array(z.string()).optional(),
  is_recommended: z.boolean().optional().default(false),
});

const HistogramSchema = z
  .object({
    duration_weeks: z.number().int().min(1).optional(),
    start_date: z.string().nullable().optional(),
    rows: z
      .array(
        z.object({
          activity: z.string(),
          service_code: z.string().optional(),
          headcount_by_week: z.array(z.number().min(0)),
          total_mh: z.number().min(0).optional(),
        }),
      )
      .optional(),
  })
  .optional();

const RiskSchema = z.object({
  risk_id: z.string(),
  description: z.string(),
  category: z.enum([
    'SCOPE',
    'QUANTITY',
    'PRICE',
    'SCHEDULE',
    'WEATHER',
    'ACCESS',
    'DESIGN_INCOMPLETE',
    'REGULATORY',
    'SUBCONTRACTOR',
    'OTHER',
  ]),
  likelihood: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  impact: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  cost_impact_low: z.number().optional(),
  cost_impact_high: z.number().optional(),
  mitigation: z.string().optional(),
  linked_service_codes: z.array(z.string()).optional(),
  needs_human_review: z.boolean().optional().default(false),
});

const SummarySchema = z.object({
  recommended_scenario_code: z.string(),
  total_bid_price: z.number(),
  metrics: z
    .object({
      price_per_sf_finished: z.number().optional(),
      price_per_sf_wall: z.number().optional(),
      material_pct: z.number().optional(),
      labor_pct: z.number().optional(),
      total_man_hours: z.number().optional(),
      schedule_weeks: z.number().int().optional(),
    })
    .optional(),
  recommendation_rationale: z.string().optional(),
});

const ReviewFlagSchema = z.object({
  target: z.string(),
  reason: z.string(),
  severity: z.enum(['INFO', 'REVIEW', 'BLOCKER']),
});

const GeneratedBySchema = z
  .object({
    agent: z.string(),
    skill: z.string().optional(),
    skills_invoked: z.array(z.string()).optional(),
    generated_at: z.string(),
    source_documents: z
      .array(
        z.object({
          filename: z.string(),
          kind: z.enum(['plans', 'specs', 'scope', 'rfp', 'addendum', 'photo', 'other']),
          pages_read: z.string().optional(),
        }),
      )
      .optional(),
  })
  .optional();

// TOP-LEVEL SCHEMA
export const CoworkImportV1Schema = z.object({
  schema_version: z.literal('1.0.0'),
  generated_by: GeneratedBySchema,
  estimate_meta: EstimateMetaSchema,
  scope_items: z.array(ScopeItemSchema),
  takeoff_items: z.array(TakeoffItemSchema),
  materials: z.array(MaterialSchema),
  labor_rates: z.array(LaborRateSchema),
  labor_productivity: z.array(LaborProductivitySchema),
  equipment: z.array(EquipmentSchema),
  scenarios: z.array(ScenarioSchema).min(1),
  histogram: HistogramSchema,
  risks: z.array(RiskSchema).optional(),
  summary: SummarySchema,
  review_flags: z.array(ReviewFlagSchema).optional(),
});

export type CoworkImportV1 = z.infer<typeof CoworkImportV1Schema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type ScopeItem = z.infer<typeof ScopeItemSchema>;
export type TakeoffItem = z.infer<typeof TakeoffItemSchema>;
export type Material = z.infer<typeof MaterialSchema>;
export type LaborProductivity = z.infer<typeof LaborProductivitySchema>;
export type Equipment = z.infer<typeof EquipmentSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type ReviewFlag = z.infer<typeof ReviewFlagSchema>;
