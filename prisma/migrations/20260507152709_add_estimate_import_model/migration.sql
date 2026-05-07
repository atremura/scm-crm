-- CreateEnum
CREATE TYPE "import_source" AS ENUM ('cowork');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('pending', 'previewed', 'applied', 'rejected', 'failed');

-- CreateTable
CREATE TABLE "estimate_imports" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "estimate_id" TEXT,
    "source" "import_source" NOT NULL DEFAULT 'cowork',
    "schema_version" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "file_blob_url" TEXT,
    "status" "import_status" NOT NULL DEFAULT 'pending',
    "raw_payload" JSONB NOT NULL,
    "preview_summary" JSONB,
    "applied_by_id" TEXT,
    "applied_at" TIMESTAMPTZ(6),
    "rejected_by_id" TEXT,
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estimate_imports_project_status_idx" ON "estimate_imports"("project_id", "status");

-- CreateIndex
CREATE INDEX "estimate_imports_company_created_idx" ON "estimate_imports"("company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "estimate_imports_project_file_unique" ON "estimate_imports"("project_id", "file_hash");

-- AddForeignKey
ALTER TABLE "estimate_imports" ADD CONSTRAINT "estimate_imports_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_imports" ADD CONSTRAINT "estimate_imports_project_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_imports" ADD CONSTRAINT "estimate_imports_estimate_fk" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_imports" ADD CONSTRAINT "estimate_imports_applied_by_fk" FOREIGN KEY ("applied_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_imports" ADD CONSTRAINT "estimate_imports_rejected_by_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

