/** Constants and enums for the Takeoff module — safe for client + server. */

// ============================================================
// Project
// ============================================================

// status transitions:
//   active ──(Send to Estimate)──▶ sent_to_estimate
//   sent_to_estimate ──(receiver accepts)──▶ estimate_accepted
//   any ──(Archive)──▶ archived
export const VALID_PROJECT_STATUSES = [
  'active',
  'sent_to_estimate',
  'estimate_accepted',
  'archived',
] as const;
export type ProjectStatus = (typeof VALID_PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  sent_to_estimate: 'Sent to Estimate',
  estimate_accepted: 'Estimate accepted',
  archived: 'Archived',
};

// ============================================================
// Project Documents
// ============================================================

// Contract + submittal live in the Contract module, not here.
export const VALID_PROJECT_DOCUMENT_TYPES = [
  'plans',
  'specs',
  'addendum',
  'photo',
  'other',
] as const;
export type ProjectDocumentType = (typeof VALID_PROJECT_DOCUMENT_TYPES)[number];

/** Plans can be huge — architectural sets regularly exceed 50 MB. Allow 200. */
export const PROJECT_DOC_MAX_SIZE_BYTES = 200 * 1024 * 1024;

/**
 * Allowed file extensions for project documents. Broader than Bid attachments
 * because we store plans (dwg, rvt), spec PDFs, photos, and zipped submissions.
 */
export const PROJECT_DOC_ALLOWED_EXTENSIONS = [
  'pdf',
  'dwg',
  'dxf',
  'rvt',
  'xls',
  'xlsx',
  'doc',
  'docx',
  'png',
  'jpg',
  'jpeg',
  'zip',
] as const;

// ============================================================
// Classifications
// ============================================================

export const VALID_CLASSIFICATION_TYPES = ['area', 'linear', 'count'] as const;
export type ClassificationType = (typeof VALID_CLASSIFICATION_TYPES)[number];

export const VALID_UOM = ['SF', 'LF', 'EA'] as const;
export type Uom = (typeof VALID_UOM)[number];

// Tells the downstream Estimate / proposal pipeline whether we're pricing
// labor only or labor + materials for this classification. The AI reads
// this to know what to include when generating a quote.
export const VALID_CLASSIFICATION_SCOPES = [
  'service',
  'service_and_material',
] as const;
export type ClassificationScope = (typeof VALID_CLASSIFICATION_SCOPES)[number];

export const CLASSIFICATION_SCOPE_LABELS: Record<ClassificationScope, string> = {
  service: 'Service only',
  service_and_material: 'Service + Material',
};

/** Short badge label for list/table views. */
export const CLASSIFICATION_SCOPE_BADGE: Record<ClassificationScope, string> = {
  service: 'S',
  service_and_material: 'S+M',
};

/** Default UOM for each classification type — used as a suggestion in forms. */
export const DEFAULT_UOM_BY_TYPE: Record<ClassificationType, Uom> = {
  area: 'SF',
  linear: 'LF',
  count: 'EA',
};

// ============================================================
// Imports
// ============================================================

export const VALID_TAKEOFF_IMPORT_SOURCES = ['togal', 'manual', 'csv'] as const;
export type TakeoffImportSource = (typeof VALID_TAKEOFF_IMPORT_SOURCES)[number];

/**
 * Togal's "FT" (linear feet) maps to our "LF". Keep this in one place so the
 * importer and any future export stay consistent.
 */
export function normalizeUom(raw: string): Uom | null {
  const u = raw.trim().toUpperCase();
  if (u === 'FT' || u === 'LF') return 'LF';
  if (u === 'SF') return 'SF';
  if (u === 'EA') return 'EA';
  return null;
}

/** Map a UOM to the classification type it implies. */
export function typeForUom(uom: Uom): ClassificationType {
  switch (uom) {
    case 'SF':
      return 'area';
    case 'LF':
      return 'linear';
    case 'EA':
      return 'count';
  }
}
