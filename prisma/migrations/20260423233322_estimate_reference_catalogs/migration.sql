-- CreateTable
CREATE TABLE "divisions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_trades" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "division_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_rates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "region_id" TEXT NOT NULL,
    "shop_type" TEXT NOT NULL,
    "low_cents" INTEGER,
    "avg_cents" INTEGER NOT NULL,
    "high_cents" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productivity_entries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "division_id" TEXT NOT NULL,
    "scope_name" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "crew_description" TEXT,
    "assumed_trade_id" TEXT,
    "mh_per_unit_low" DECIMAL(10,4),
    "mh_per_unit_avg" DECIMAL(10,4) NOT NULL,
    "mh_per_unit_high" DECIMAL(10,4),
    "match_code" TEXT,
    "match_keywords" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productivity_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_types" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "division_id" TEXT,
    "material_type_id" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "uom" TEXT NOT NULL,
    "low_cents" INTEGER,
    "avg_cents" INTEGER NOT NULL,
    "high_cents" INTEGER,
    "waste_percent" INTEGER NOT NULL DEFAULT 5,
    "supplier" TEXT,
    "supplier_url" TEXT,
    "last_priced_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assemblies" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "division_id" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "default_scope" TEXT NOT NULL DEFAULT 'service_and_material',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assemblies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assembly_components" (
    "id" TEXT NOT NULL,
    "assembly_id" TEXT NOT NULL,
    "component_name" TEXT NOT NULL,
    "qty_per_unit" DECIMAL(12,4) NOT NULL,
    "component_uom" TEXT NOT NULL,
    "productivity_id" TEXT,
    "labor_trade_id" TEXT,
    "material_id" TEXT,
    "mh_per_component" DECIMAL(10,4),
    "material_cost_cents" INTEGER,
    "waste_percent_override" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assembly_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_factors" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "region_id" TEXT,
    "name" TEXT NOT NULL,
    "impact_percent" DECIMAL(5,3) NOT NULL,
    "applies_to" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "auto_apply" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_factors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "divisions_company_id_idx" ON "divisions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "divisions_company_id_name_key" ON "divisions"("company_id", "name");

-- CreateIndex
CREATE INDEX "regions_company_id_idx" ON "regions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "regions_company_id_state_code_key" ON "regions"("company_id", "state_code");

-- CreateIndex
CREATE INDEX "labor_trades_company_id_idx" ON "labor_trades"("company_id");

-- CreateIndex
CREATE INDEX "labor_trades_division_id_idx" ON "labor_trades"("division_id");

-- CreateIndex
CREATE UNIQUE INDEX "labor_trades_company_id_name_key" ON "labor_trades"("company_id", "name");

-- CreateIndex
CREATE INDEX "labor_rates_company_id_idx" ON "labor_rates"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "labor_rates_company_id_trade_id_region_id_shop_type_key" ON "labor_rates"("company_id", "trade_id", "region_id", "shop_type");

-- CreateIndex
CREATE INDEX "productivity_entries_company_id_idx" ON "productivity_entries"("company_id");

-- CreateIndex
CREATE INDEX "productivity_entries_division_id_idx" ON "productivity_entries"("division_id");

-- CreateIndex
CREATE INDEX "productivity_entries_match_code_idx" ON "productivity_entries"("match_code");

-- CreateIndex
CREATE INDEX "material_types_company_id_idx" ON "material_types"("company_id");

-- CreateIndex
CREATE INDEX "material_types_parent_id_idx" ON "material_types"("parent_id");

-- CreateIndex
CREATE INDEX "materials_company_id_idx" ON "materials"("company_id");

-- CreateIndex
CREATE INDEX "materials_division_id_idx" ON "materials"("division_id");

-- CreateIndex
CREATE INDEX "materials_material_type_id_idx" ON "materials"("material_type_id");

-- CreateIndex
CREATE INDEX "assemblies_company_id_idx" ON "assemblies"("company_id");

-- CreateIndex
CREATE INDEX "assemblies_division_id_idx" ON "assemblies"("division_id");

-- CreateIndex
CREATE INDEX "assemblies_code_idx" ON "assemblies"("code");

-- CreateIndex
CREATE INDEX "assembly_components_assembly_id_idx" ON "assembly_components"("assembly_id");

-- CreateIndex
CREATE INDEX "cost_factors_company_id_idx" ON "cost_factors"("company_id");

-- CreateIndex
CREATE INDEX "cost_factors_region_id_idx" ON "cost_factors"("region_id");

-- AddForeignKey
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_trades" ADD CONSTRAINT "labor_trades_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_trades" ADD CONSTRAINT "labor_trades_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_rates" ADD CONSTRAINT "labor_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_rates" ADD CONSTRAINT "labor_rates_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "labor_trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_rates" ADD CONSTRAINT "labor_rates_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productivity_entries" ADD CONSTRAINT "productivity_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productivity_entries" ADD CONSTRAINT "productivity_entries_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productivity_entries" ADD CONSTRAINT "productivity_entries_assumed_trade_id_fkey" FOREIGN KEY ("assumed_trade_id") REFERENCES "labor_trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_types" ADD CONSTRAINT "material_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_types" ADD CONSTRAINT "material_types_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "material_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_material_type_id_fkey" FOREIGN KEY ("material_type_id") REFERENCES "material_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assemblies" ADD CONSTRAINT "assemblies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assemblies" ADD CONSTRAINT "assemblies_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_components" ADD CONSTRAINT "assembly_components_assembly_id_fkey" FOREIGN KEY ("assembly_id") REFERENCES "assemblies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_components" ADD CONSTRAINT "assembly_components_productivity_id_fkey" FOREIGN KEY ("productivity_id") REFERENCES "productivity_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_components" ADD CONSTRAINT "assembly_components_labor_trade_id_fkey" FOREIGN KEY ("labor_trade_id") REFERENCES "labor_trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assembly_components" ADD CONSTRAINT "assembly_components_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_factors" ADD CONSTRAINT "cost_factors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_factors" ADD CONSTRAINT "cost_factors_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
