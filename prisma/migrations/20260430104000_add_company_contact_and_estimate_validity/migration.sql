-- Proposal-header contact fields (printed on client-facing exports)
ALTER TABLE "companies" ADD COLUMN "phone" TEXT;
ALTER TABLE "companies" ADD COLUMN "email" TEXT;
ALTER TABLE "companies" ADD COLUMN "contact_name" TEXT;

-- Estimate validity window (default 30 days from issue date)
ALTER TABLE "estimates" ADD COLUMN "valid_for_days" INTEGER NOT NULL DEFAULT 30;
