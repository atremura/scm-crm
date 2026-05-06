# Cowork Import Schema — `scm-crm`

**Schema version:** 1.0.0
**Last updated:** 2026-05-07
**Status:** Official contract between Cowork Desktop and scm-crm
**Owner:** Andre Tremura

> 📄 The authoritative JSON Schema is in `docs/cowork-import.schema.json`.
> This document explains _how_ the JSON is used by scm-crm: validation
> beyond the schema, mapping to internal data model, API endpoints,
> and architectural decisions.

---

## 1. Purpose

This document defines the contract between **Cowork Desktop** (external estimating tool) and **scm-crm** (this repository).

Cowork analyzes project documents (plans, specs, scope sheets) and produces a single JSON document conforming to v1.0.0 of `cowork-import.schema.json`. The scm-crm imports that JSON via `POST /api/projects/[id]/import-cowork`, validates it against the schema **plus integrity rules** (section 4), maps the 11 JSON blocks to scm-crm's existing data model (section 5), and creates Classifications + EstimateLines for human review.

## 2. Why Cowork is external

The previous "Phase 1 Project AI Analyst" (in-app Claude Files API analysis) is being deprecated. Reasons:

- Long-running AI calls inside HTTP requests caused app freezes
- AI cost was unbounded — every analysis charged Anthropic credits
- Polling for analysis results added complexity to UI

By moving analysis to Cowork (external desktop tool), we get:

- App stays fast — no long-running AI inside HTTP cycles
- Cost bounded — analysis happens only when user invokes Cowork
- 30-minute analyses become acceptable (no timeout pressure)
- Clean separation: Cowork analyzes, scm-crm manages workflow and pricing

## 3. Two paths in Module 2

**Path A — AI-assisted (Cowork):** for medium/large projects worth investing in AI analysis.

1. Bid accepted → Project created in scm-crm
2. User opens Cowork Desktop separately and runs analysis
3. Cowork produces `<project>_estimate.json` conforming to v1.0.0
4. User uploads JSON via scm-crm import endpoint
5. scm-crm creates Classifications + EstimateLines
6. Human estimator reviews and adjusts in scm-crm

**Path B — Manual (no AI):** for small/repair jobs where the estimator's experience is enough. Bypasses Cowork entirely; estimator adds classifications directly via scm-crm UI.

## 4. Integrity rules (semantic validation beyond JSON Schema)

The JSON Schema in `cowork-import.schema.json` validates **structure**. These rules validate **semantic consistency** — the JSON can be schema-valid but semantically broken. The scm-crm importer enforces these. Cowork's own skills also enforce them at generation time (defense in depth).

These rules were discovered during the 2026-05-07 sanity-check comparing the Knotty Way full estimate vs. the siding-only derivation.

### Rule 1 — Material coverage (BLOCKER)

For every `scope_items[i]` where `type ∈ ("M", "M+L")`, there must exist at least one `materials[j]` with `service_code === scope_items[i].service_code`.

**Why:** original Knotty Way JSON had 12 siding scope items but only 2 material rows linked. Resulted in $80k undercount. Cannot import a JSON that promises material installation without listing the materials.

**Importer behavior:** reject with HTTP 400 + clear error listing missing service codes.

### Rule 2 — Productivity coverage (BLOCKER)

For every `scope_items[i]` where `type ∈ ("L", "M+L")`, there must exist at least one `labor_productivity[j]` with `service_code === scope_items[i].service_code`.

**Why:** mirrors Rule 1 for labor. A scope item that promises labor installation must have at least one productivity row driving its hours calculation.

**Importer behavior:** reject with HTTP 400 + listing of missing service codes.

### Rule 3 — Histogram-productivity consistency (WARNING)

`sum(histogram.rows[].total_mh)` should be within ±25% of `sum(labor_productivity[].total_mh)`.

**Why:** histogram derived independently of productivity led to 5x discrepancies in the Knotty Way test. The 25% margin allows for logistics/weather buffer.

**Importer behavior:** create a `Suggestion` row with severity REVIEW flagging the discrepancy. Allow import to proceed.

### Rule 4 — Service code consistency (BLOCKER)

Every `service_code` referenced in `takeoff_items`, `materials`, `labor_productivity`, or `histogram.rows` must exist in `scope_items`.

**Why:** orphan references mean someone is pricing/quantifying a service that wasn't formally scoped. Either scope is incomplete or there's a typo.

**Importer behavior:** reject with HTTP 400 + listing of orphan service codes.

### Rule 5 — Allowance consistency (WARNING)

If `scope_items[i].status === "ALLOWANCE"`, then `allowance_amount` must be present and > 0.

**Why:** allowances without amounts are useless — they create scope items the estimator must hunt down to price.

**Importer behavior:** create `Suggestion` row with severity REVIEW. Allow import to proceed.

### Rule 6 — Geometry plausibility (WARNING)

If `takeoff_items[i].geometry.projected_area_sf` and `geometry.slope_factor` are both present, then `takeoff_items[i].quantity` should be within ±5% of `projected_area_sf × slope_factor`.

**Why:** sanity check. Reviewer can catch typos in either input or output.

**Importer behavior:** create `Suggestion` row with severity REVIEW.

### Rule 7 — Recommended scenario must exist (BLOCKER)

`summary.recommended_scenario_code` must match one of `scenarios[i].scenario_code`.

**Why:** the summary tells the reviewer "use scenario X." If X doesn't exist, the recommendation is broken.

**Importer behavior:** reject with HTTP 400.

### Rule 8 — Tenant slug match (BLOCKER, post-multi-tenancy)

If `estimate_meta.tenant_slug` is non-null, it must match the slug of the authenticated user's company.

**Why:** prevents cross-tenant import (uploading a JSON intended for tenant A into tenant B's session). Currently scm-crm is dev-only with single tenant, so this rule is informational; it becomes BLOCKER once multi-tenancy ships.

**Importer behavior (current, dev):** ignore mismatch with INFO log.
**Importer behavior (production, multi-tenant):** reject with HTTP 403.

## 5. Mapping JSON → scm-crm data model

The 11 JSON blocks do NOT map 1:1 to scm-crm tables. Cowork designed for a learning-loop-enabled future state with separate tables per concept. scm-crm currently has a simpler model. We adapt:

| Cowork JSON block                                | scm-crm destination                                                  | Notes                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `estimate_meta`                                  | `Project` (update) + `EstimateImport` (audit)                        | Update `Project.contextHints` (new JSONB field to be added in Phase 1.2) |
| `scope_items` (status=INCLUDED)                  | `Classification` rows                                                | One per scope item; `service_code` → matchCode                           |
| `scope_items` (status=EXCLUDED, ALLOWANCE, etc.) | `Suggestion` rows                                                    | Status preserved as note; reviewer decides                               |
| `takeoff_items`                                  | Quantity + UOM on `EstimateLine`                                     | Geometry block → `EstimateLine.notes` JSON                               |
| `materials`                                      | Material breakdown in `EstimateLine.materialBreakdown`               | `unit_cost` → `unitCostCents`; `*_final` populated on review             |
| `labor_rates`                                    | Validated against `LaborRate` master data; mismatches → `Suggestion` | Cowork rates not auto-saved to master data                               |
| `labor_productivity`                             | `mh_per_unit` → `EstimateLine.mhPerUnit` (matched via service_code)  | Crew composition stored in `EstimateLine.notes`                          |
| `equipment`                                      | `EstimateLine` rows with type='equipment'                            | Future: dedicated `EstimateEquipment` table                              |
| `scenarios`                                      | **Not stored** in v1.0 of importer                                   | Saved verbatim in `EstimateImport.rawPayload` for future use             |
| `histogram`                                      | **Not stored** in v1.0 of importer                                   | Saved verbatim in `EstimateImport.rawPayload` for future use             |
| `risks`                                          | `Suggestion` rows with severity REVIEW                               | category preserved as note                                               |
| `review_flags`                                   | `Suggestion` rows; severity maps directly                            | BLOCKER prevents apply until resolved                                    |
| `summary`                                        | `Estimate` totals (recomputed by scm-crm pricing engine)             | Cowork totals stored as audit reference only                             |

**Key principle:** scm-crm pricing engine (`src/lib/estimate-pricing.ts`) recomputes totals from line items + master data. Cowork's totals are **reference**, not authoritative. This ensures consistency with estimates created via Path B (manual).

## 6. EstimateImport audit row

Every import attempt creates an `EstimateImport` row that preserves the full JSON for replay/audit. Schema (Prisma model to be added in Phase 1.2):

- `id`, `companyId`, `projectId`, `estimateId` (nullable until estimate created)
- `source` ("cowork" | future sources)
- `schemaVersion` ("1.0.0")
- `fileName`, `fileHash` (SHA256 — prevents duplicate import), `fileBlobUrl` (Vercel Blob)
- `status` ("pending" | "previewed" | "applied" | "rejected" | "failed")
- `rawPayload` (JSONB — full JSON verbatim)
- `previewSummary` (JSONB — `{ newClassifications, newLines, suggestions, warnings, errors }`)
- `appliedById`, `appliedAt`, `rejectedById`, `rejectedAt` (nullable)
- `createdAt`

**Why preserve raw payload:** allows replay. If Cowork's logic changes years later, we can reconstruct what was originally imported. Also gives us scenarios/histogram data when those features ship.

## 7. API endpoints

All endpoints are nested under a project (multi-tenant via session auth) and require edit access on that project.

### POST `/api/projects/[id]/import-cowork`

Upload a Cowork JSON and generate a preview. Does **not** modify project data.

**Request:**

- Method: `POST`
- Body: `multipart/form-data` with field `file` containing the `.json`
- Auth: session cookie; user must have edit access on project `[id]`

**Behavior:**

1. Authenticate; verify edit access on the project
2. Compute SHA256 of file bytes; reject if a previously-applied import has the same hash (HTTP 409 Conflict)
3. Parse JSON; validate against `cowork-import.schema.json` v1.0.0 (HTTP 400 with field-level errors if invalid)
4. Run integrity rules (section 4):
   - **BLOCKER** violations → reject with HTTP 400, include violations array
   - **WARNING** violations → continue, accumulate in `previewSummary.warnings`
5. Generate preview by simulating the apply step in-memory:
   - Count Classifications that would be created
   - Count EstimateLines that would be created
   - Count Suggestion rows (from `risks`, `review_flags`, mismatches)
   - List labor rate mismatches against tenant `LaborRate` table
   - List service codes that don't exist in `Classification` master data
6. Persist `EstimateImport` row with `status='previewed'`, `rawPayload` = full JSON, `previewSummary` = the counts and warnings
7. Return `{ importId, preview }` with HTTP 201

**Response (success, 201):**

```json
{
  "importId": "imp_...",
  "preview": {
    "newClassifications": 12,
    "newLines": 47,
    "newSuggestions": 8,
    "warnings": [{ "rule": "histogram-productivity", "message": "...", "severity": "REVIEW" }],
    "laborRateMismatches": [{ "trade": "Mason", "cowork_billed_hr": 92.5, "master_data_hr": 88.0 }]
  }
}
```

**Response (validation error, 400):**

```json
{
  "error": "schema_validation_failed",
  "violations": [
    {
      "path": "/scope_items/3/service_code",
      "message": "must match pattern ^[A-Z]{1,3}-[0-9]{2,3}$"
    }
  ]
}
```

**Response (integrity error, 400):**

```json
{
  "error": "integrity_violation",
  "blockers": [
    {
      "rule": "material_coverage",
      "service_codes": ["S-04", "S-07"],
      "message": "scope items with type=M+L but no materials linked"
    }
  ]
}
```

**Response (duplicate, 409):**

```json
{
  "error": "duplicate_import",
  "previousImportId": "imp_...",
  "previousAppliedAt": "2026-05-08T14:30:00Z"
}
```

### POST `/api/projects/[id]/import-cowork/[importId]/apply`

Apply a previously-previewed import. Creates Classifications, EstimateLines, Suggestions in a single transaction.

**Request:**

- Method: `POST`
- Body: empty (or optional `{ confirmReplace: boolean }` for projects with existing classifications)
- Auth: session; edit access on project; user authoring the apply may differ from user that uploaded

**Behavior:**

1. Verify `importId` matches project `[id]` and `EstimateImport.status === 'previewed'`
2. Open Prisma transaction:
   - Update `Project.contextHints` (JSONB) with `estimate_meta` data
   - Create `Classification` rows from `scope_items` with `status='INCLUDED'`
   - Create `EstimateLine` rows from `takeoff_items` + `materials` + `labor_productivity` (joined by `service_code`)
   - Create `Suggestion` rows from `risks`, `review_flags`, scope items with non-INCLUDED status, and warnings
   - Update `EstimateImport`: `status='applied'`, `appliedAt`, `appliedById`
3. Commit; return `{ estimateId, summary }` with HTTP 200

**Response (success, 200):**

```json
{
  "estimateId": "est_...",
  "summary": {
    "classificationsCreated": 12,
    "linesCreated": 47,
    "suggestionsCreated": 8
  }
}
```

**Response (wrong status, 409):**

```json
{ "error": "import_not_in_previewed_state", "currentStatus": "applied" }
```

### POST `/api/projects/[id]/import-cowork/[importId]/reject`

Reject a previewed import. Does not delete it — audit trail is preserved.

**Request:**

- Method: `POST`
- Body: optional `{ reason?: string }`
- Auth: session; edit access on project

**Behavior:**

1. Verify `importId` matches project; `status === 'previewed'`
2. Update `EstimateImport`: `status='rejected'`, `rejectedAt`, `rejectedById`, optional `rejectionReason`
3. Return `{ ok: true }`

### GET `/api/projects/[id]/imports`

List all `EstimateImport` rows for the project (audit history view).

**Request:**

- Method: `GET`
- Auth: session; view access on project

**Response (200):**

```json
{
  "imports": [
    {
      "importId": "imp_...",
      "fileName": "smith_residence_estimate.json",
      "status": "applied",
      "schemaVersion": "1.0.0",
      "createdAt": "2026-05-08T14:30:00Z",
      "appliedAt": "2026-05-08T14:35:00Z",
      "appliedBy": { "id": "...", "name": "Andre Tremura" },
      "summary": { "newLines": 47, "newSuggestions": 8 }
    }
  ]
}
```

### Error response shape (general)

All error responses follow:

```json
{
  "error": "<machine-readable code>",
  "message": "<human-readable, optional>",
  "details": { ... }
}
```

## 8. UI integration points

`/takeoff/[id]` (existing page) gains:

- Button "Import Cowork Output" in toolbar
- Drawer drag-drop for .json file
- Preview shows: "X classifications, Y line items, Z suggestions, W warnings"
- BLOCKER errors prevent Apply button enabling
- Apply / Reject buttons; status persists

`/takeoff/[id]/imports` (new page) shows audit list of past imports per project.

## 9. Versioning policy

| Change type        | Version bump  | Backward compatible |
| ------------------ | ------------- | ------------------- |
| Add optional field | 1.0.0 → 1.1.0 | Yes                 |
| Add required field | 1.0.0 → 2.0.0 | No                  |
| Rename field       | 1.0.0 → 2.0.0 | No                  |
| Change enum values | 1.0.0 → 2.0.0 | No                  |
| Tighten validation | 1.0.0 → 1.1.0 | Usually yes         |

scm-crm importer maintains a registry of supported `schema_version` values. Files with unsupported versions are rejected with clear error: _"This file uses Cowork schema vX.Y.Z, but this version of scm-crm supports up to vA.B.C. Update the app or regenerate with a compatible Cowork version."_

## 10. Open items / Phase 2

These features were proposed by Cowork but deferred. They're tracked here, not yet planned.

- **`*_ai` / `*_final` field pairs on EstimateLine** for variance tracking — defer until import flow is stable
- **Dedicated `EstimateScenario` table** — defer until scenarios are actively used in proposals
- **Dedicated `EstimateHistogram` table** — defer
- **Learning loop** (`EstimateLearningObservation` + procs that update Master Data after estimate approval) — biggest deferred feature; requires 10-20 approved estimates worth of data before useful
- **Equipment pool reconciliation** at scm-crm level (cross-service scaffold/PM allocation) — currently happens inside Cowork master skill

Don't implement without explicit prioritization.

## 11. References

- **JSON Schema (authoritative):** `docs/cowork-import.schema.json`
- **Architecture overview:** `docs/architecture-EN.md` (or `architecture-PT.md`)
- **Project context for AI agents:** `CLAUDE.md`
- **Original Knotty Way JSON example (reference):** Cowork team archive
- **Schema validation library:** Zod (`zod` package), to be installed in Phase 2

---

_Cowork delivered schema v1.0.0 on 2026-05-06. Sanity-check vs. Knotty Way
on 2026-05-07 surfaced 4 issues that became integrity rules 1, 2, 3, and
4 of section 4. Cowork team patched their child + master skills the same
day to enforce coverage and histogram derivation at generation time._
