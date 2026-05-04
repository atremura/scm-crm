-- ============================================================
-- Phase 1: Project AI Analyst — schema additions
-- ============================================================
-- Adds ProjectAnalysisRun (audit trail of AI scope analyses) and
-- ClassificationCalibration (one row per AI-proposed item to track
-- accuracy over time).
--
-- Existing tables get a few opt-in columns to track AI provenance.
-- Pricing tables (estimate_lines, productivity_entries, etc.) are
-- NOT touched — see briefing §6.
-- ============================================================

-- ProjectAnalysisRun ----------------------------------------------
CREATE TABLE "project_analysis_runs" (
  "id"                  TEXT PRIMARY KEY,
  "company_id"          TEXT        NOT NULL,
  "project_id"          TEXT        NOT NULL,

  -- API call audit
  "model_used"          TEXT        NOT NULL,
  "prompt_version"      TEXT        NOT NULL,
  "input_tokens"        INTEGER,
  "output_tokens"       INTEGER,
  "cache_read_tokens"   INTEGER,
  "cache_write_tokens"  INTEGER,
  "cost_cents"          DECIMAL(10,4),

  -- snapshot of ProjectDocument.id values fed to the API
  "document_ids"        TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Full payloads for replay / debugging
  "request_payload"     JSONB       NOT NULL,
  "response_payload"    JSONB       NOT NULL,
  "parsed_result"       JSONB,
  "error_message"       TEXT,

  -- Review state
  -- pending | accepted | partially_accepted | rejected | failed
  "status"              TEXT        NOT NULL DEFAULT 'pending',
  "reviewed_by"         TEXT,
  "reviewed_at"         TIMESTAMP(3),
  "review_note"         TEXT,

  -- Counters for the project list / dashboard
  "items_proposed"      INTEGER     NOT NULL DEFAULT 0,
  "items_accepted"      INTEGER     NOT NULL DEFAULT 0,
  "items_rejected"      INTEGER     NOT NULL DEFAULT 0,

  "started_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"        TIMESTAMP(3),
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "project_analysis_runs_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id"),
  CONSTRAINT "project_analysis_runs_project_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "project_analysis_runs_reviewer_fk"
    FOREIGN KEY ("reviewed_by") REFERENCES "users"("id")
);

CREATE INDEX "project_analysis_runs_company_idx"
  ON "project_analysis_runs"("company_id");
CREATE INDEX "project_analysis_runs_project_idx"
  ON "project_analysis_runs"("project_id");
CREATE INDEX "project_analysis_runs_status_idx"
  ON "project_analysis_runs"("status");

-- ClassificationCalibration ---------------------------------------
CREATE TABLE "classification_calibration" (
  "id"                          TEXT PRIMARY KEY,
  "company_id"                  TEXT        NOT NULL,
  "project_id"                  TEXT        NOT NULL,
  "analysis_run_id"             TEXT        NOT NULL,
  -- null when the proposal was rejected (no Classification was created)
  "classification_id"           TEXT,

  -- Snapshot of what the AI proposed
  "proposed_name"               TEXT        NOT NULL,
  "proposed_external_id"        TEXT,
  "proposed_quantity"           DECIMAL(14,3) NOT NULL,
  "proposed_uom"                TEXT        NOT NULL,
  "proposed_scope"              TEXT        NOT NULL,
  "proposed_confidence"         INTEGER     NOT NULL, -- 0-100
  "proposed_division_hint"      TEXT,
  "proposed_productivity_hint"  TEXT,
  "prompt_version"              TEXT        NOT NULL,

  -- What Andre kept after review
  "final_quantity"              DECIMAL(14,3),
  "final_uom"                   TEXT,
  "was_accepted"                BOOLEAN     NOT NULL DEFAULT false,
  "quantity_delta_percent"      DECIMAL(8,3),

  -- Filled later when Andre traces the same item in Togal
  "togal_verified_quantity"     DECIMAL(14,3),
  "togal_verified_at"           TIMESTAMP(3),

  -- Aggregation hints (denormalized from resolver output)
  "division_id"                 TEXT,
  "match_code"                  TEXT,

  "notes"                       TEXT,
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "classification_calibration_company_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id"),
  CONSTRAINT "classification_calibration_project_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "classification_calibration_run_fk"
    FOREIGN KEY ("analysis_run_id") REFERENCES "project_analysis_runs"("id") ON DELETE CASCADE,
  CONSTRAINT "classification_calibration_classification_fk"
    FOREIGN KEY ("classification_id") REFERENCES "classifications"("id"),
  CONSTRAINT "classification_calibration_division_fk"
    FOREIGN KEY ("division_id") REFERENCES "divisions"("id")
);

CREATE INDEX "classification_calibration_company_idx"
  ON "classification_calibration"("company_id");
CREATE INDEX "classification_calibration_project_idx"
  ON "classification_calibration"("project_id");
CREATE INDEX "classification_calibration_run_idx"
  ON "classification_calibration"("analysis_run_id");
CREATE INDEX "classification_calibration_division_match_idx"
  ON "classification_calibration"("division_id", "match_code");

-- AI provenance on Classification ---------------------------------
ALTER TABLE "classifications"
  ADD COLUMN "source_analysis_run_id"     TEXT,
  ADD COLUMN "ai_confidence"              INTEGER,
  ADD COLUMN "quantity_basis"             TEXT,
  ADD COLUMN "needs_togal_verification"   BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "classifications"
  ADD CONSTRAINT "classifications_source_analysis_run_fk"
    FOREIGN KEY ("source_analysis_run_id")
    REFERENCES "project_analysis_runs"("id");

CREATE INDEX "classifications_source_analysis_run_idx"
  ON "classifications"("source_analysis_run_id");

-- Verification gate flag on Estimate -------------------------------
ALTER TABLE "estimates"
  ADD COLUMN "requires_togal_verification" BOOLEAN NOT NULL DEFAULT false;
