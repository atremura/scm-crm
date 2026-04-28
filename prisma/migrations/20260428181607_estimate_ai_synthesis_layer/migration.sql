-- Estimate AI synthesis layer
-- Adds:
--   1. Project context fields (populated by IA-1)
--   2. Classification Togal-native fields + structured divisionId FK (L1/L2 resolver)
--   3. EstimateLine source/parentLineId/derivedFromRuleId (provenance + IA-2 children)
--   4. Estimate ai-hidden-costs run metadata
--   5. derivative_cost_rules table (rules engine that drives IA-2)
--   6. suggestions table (AI proposes, Andre approves — applies to master tables)

-- 1. Project context (IA-1)
ALTER TABLE "projects"
  ADD COLUMN "stories"             INTEGER,
  ADD COLUMN "duration_weeks"      INTEGER,
  ADD COLUMN "site_conditions"     JSONB,
  ADD COLUMN "required_equipment"  JSONB,
  ADD COLUMN "winter_risk"         BOOLEAN,
  ADD COLUMN "permit_checklist"    TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "ai_context_run_at"   TIMESTAMPTZ,
  ADD COLUMN "ai_context_result"   JSONB;

-- 2. Classification — Togal-native fields + structured FK
ALTER TABLE "classifications"
  ADD COLUMN "togal_id"             TEXT,
  ADD COLUMN "togal_folder"         TEXT,
  ADD COLUMN "togal_label_original" TEXT,
  ADD COLUMN "division_id"          TEXT;

ALTER TABLE "classifications"
  ADD CONSTRAINT "classifications_division_id_fkey"
  FOREIGN KEY ("division_id") REFERENCES "divisions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "classifications_division_id_idx" ON "classifications"("division_id");

-- 3. EstimateLine — provenance + derivative chaining
ALTER TABLE "estimate_lines"
  ADD COLUMN "source"                TEXT,
  ADD COLUMN "parent_line_id"        TEXT,
  ADD COLUMN "derived_from_rule_id"  TEXT;

ALTER TABLE "estimate_lines"
  ADD CONSTRAINT "estimate_lines_parent_line_id_fkey"
  FOREIGN KEY ("parent_line_id") REFERENCES "estimate_lines"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "estimate_lines_parent_line_id_idx" ON "estimate_lines"("parent_line_id");

-- 4. Estimate — IA-2 run metadata
ALTER TABLE "estimates"
  ADD COLUMN "ai_hidden_costs_run_at"   TIMESTAMPTZ,
  ADD COLUMN "ai_hidden_costs_result"   JSONB;

-- 5. derivative_cost_rules — fasteners, tape, dumpster, consumables, etc.
CREATE TABLE "derivative_cost_rules" (
    "id"                                TEXT NOT NULL,
    "company_id"                        TEXT NOT NULL,
    "trigger_productivity_match_code"   TEXT,
    "trigger_division_id"               TEXT,
    "name"                              TEXT NOT NULL,
    "cost_type"                         TEXT NOT NULL,
    "formula"                           JSONB NOT NULL,
    "material_id_ref"                   TEXT,
    "uom_in"                            TEXT,
    "uom_out"                           TEXT,
    "is_active"                         BOOLEAN NOT NULL DEFAULT true,
    "created_by"                        TEXT NOT NULL DEFAULT 'manual',
    "notes"                             TEXT,
    "created_at"                        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                        TIMESTAMPTZ NOT NULL,
    CONSTRAINT "derivative_cost_rules_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "derivative_cost_rules"
  ADD CONSTRAINT "derivative_cost_rules_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "derivative_cost_rules"
  ADD CONSTRAINT "derivative_cost_rules_trigger_division_id_fkey"
  FOREIGN KEY ("trigger_division_id") REFERENCES "divisions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "derivative_cost_rules_company_id_idx" ON "derivative_cost_rules"("company_id");
CREATE INDEX "derivative_cost_rules_trigger_productivity_match_code_idx" ON "derivative_cost_rules"("trigger_productivity_match_code");
CREATE INDEX "derivative_cost_rules_trigger_division_id_idx" ON "derivative_cost_rules"("trigger_division_id");

-- EstimateLine.derivedFromRuleId FK lands now that derivative_cost_rules exists
ALTER TABLE "estimate_lines"
  ADD CONSTRAINT "estimate_lines_derived_from_rule_id_fkey"
  FOREIGN KEY ("derived_from_rule_id") REFERENCES "derivative_cost_rules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. suggestions — generic AI-proposes / Andre-approves queue
CREATE TABLE "suggestions" (
    "id"                  TEXT NOT NULL,
    "company_id"          TEXT NOT NULL,
    "type"                TEXT NOT NULL,
    "payload"             JSONB NOT NULL,
    "justification"       TEXT NOT NULL,
    "confidence"          INTEGER NOT NULL DEFAULT 50,
    "source_estimate_id"  TEXT,
    "source_line_id"      TEXT,
    "model_used"          TEXT,
    "cost_cents"          DECIMAL(10,4),
    "status"              TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by_id"      TEXT,
    "reviewed_at"         TIMESTAMPTZ,
    "review_note"         TEXT,
    "applied_to_table"    TEXT,
    "applied_to_id"       TEXT,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMPTZ NOT NULL,
    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "suggestions"
  ADD CONSTRAINT "suggestions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "suggestions_company_id_status_idx" ON "suggestions"("company_id", "status");
CREATE INDEX "suggestions_type_status_idx" ON "suggestions"("type", "status");
