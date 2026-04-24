-- Add slug + unique constraint to material_types
ALTER TABLE "material_types" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "material_types_company_id_slug_key" ON "material_types"("company_id", "slug");
