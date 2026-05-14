export { CoworkImportV1Schema, ConfidenceSchema } from './schema';

export type {
  CoworkImportV1,
  Confidence,
  ScopeItem,
  TakeoffItem,
  Material,
  LaborProductivity,
  Equipment,
  Scenario,
  Risk,
  ReviewFlag,
} from './schema';

export {
  validateIntegrity,
  checkMaterialCoverage,
  checkProductivityCoverage,
  checkHistogramProductivityBand,
  checkServiceCodeConsistency,
  checkAllowanceAmount,
  checkGeometryPlausibility,
  checkRecommendedScenarioExists,
} from './integrity-rules';

export type {
  IntegrityRuleId,
  IntegritySeverity,
  IntegrityViolation,
  IntegrityCheckResult,
} from './integrity-rules';

export { computeFileHash } from './compute-file-hash';

export { checkTenantSlugMatch } from './tenant-rule';

export { previewImport, buildSummary } from './import-service';

export type { ImportPreviewResult, ImportPreviewInput, PreviewSummary } from './import-service';
