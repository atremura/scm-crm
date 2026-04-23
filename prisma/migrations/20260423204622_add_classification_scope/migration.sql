-- AlterTable
ALTER TABLE "classification_templates" ADD COLUMN     "default_scope" TEXT NOT NULL DEFAULT 'service_and_material';

-- AlterTable
ALTER TABLE "classifications" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'service_and_material';
