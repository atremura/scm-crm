-- DropForeignKey
ALTER TABLE "classification_calibration" DROP CONSTRAINT "classification_calibration_classification_fk";

-- DropForeignKey
ALTER TABLE "classification_calibration" DROP CONSTRAINT "classification_calibration_company_fk";

-- DropForeignKey
ALTER TABLE "classification_calibration" DROP CONSTRAINT "classification_calibration_division_fk";

-- DropForeignKey
ALTER TABLE "classification_calibration" DROP CONSTRAINT "classification_calibration_project_fk";

-- DropForeignKey
ALTER TABLE "classification_calibration" DROP CONSTRAINT "classification_calibration_run_fk";

-- DropForeignKey
ALTER TABLE "classifications" DROP CONSTRAINT "classifications_source_analysis_run_fk";

-- DropForeignKey
ALTER TABLE "project_analysis_runs" DROP CONSTRAINT "project_analysis_runs_company_fk";

-- DropForeignKey
ALTER TABLE "project_analysis_runs" DROP CONSTRAINT "project_analysis_runs_project_fk";

-- DropForeignKey
ALTER TABLE "project_analysis_runs" DROP CONSTRAINT "project_analysis_runs_reviewer_fk";

-- DropIndex
DROP INDEX "classifications_source_analysis_run_idx";

-- AlterTable
ALTER TABLE "classifications" DROP COLUMN "ai_confidence",
DROP COLUMN "needs_togal_verification",
DROP COLUMN "quantity_basis",
DROP COLUMN "source_analysis_run_id";

-- AlterTable
ALTER TABLE "estimates" DROP COLUMN "requires_togal_verification";

-- AlterTable
ALTER TABLE "project_documents" DROP COLUMN "anthropic_file_id";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "ai_context_result",
DROP COLUMN "ai_context_run_at",
DROP COLUMN "duration_weeks",
DROP COLUMN "permit_checklist",
DROP COLUMN "required_equipment",
DROP COLUMN "site_conditions",
DROP COLUMN "stories",
DROP COLUMN "winter_risk",
ADD COLUMN     "context_hints" JSONB;

-- DropTable
DROP TABLE "classification_calibration";

-- DropTable
DROP TABLE "project_analysis_runs";

