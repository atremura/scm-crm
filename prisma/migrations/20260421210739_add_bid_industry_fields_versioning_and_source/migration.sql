-- AlterTable
ALTER TABLE "bid_documents" ADD COLUMN     "addendum_number" INTEGER,
ADD COLUMN     "replaced_by_id" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "bids" ADD COLUMN     "bond_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "davis_bacon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "insurance_requirements" TEXT,
ADD COLUMN     "prevailing_wage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "union_job" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "bid_documents" ADD CONSTRAINT "bid_documents_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "bid_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
