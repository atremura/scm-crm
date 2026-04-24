-- Add Cowork-style proposal fields to Estimate
ALTER TABLE "estimates"
  ADD COLUMN "general_conditions_percent" DECIMAL(5, 2),
  ADD COLUMN "total_envelope_sf" DECIMAL(14, 2),
  ADD COLUMN "assumptions" TEXT;
