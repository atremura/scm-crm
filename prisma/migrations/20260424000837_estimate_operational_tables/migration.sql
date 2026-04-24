-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "owner_id" TEXT NOT NULL,
    "received_from_id" TEXT,
    "received_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "region_id" TEXT NOT NULL,
    "shop_type" TEXT NOT NULL DEFAULT 'open_shop',
    "mh_range_mode" TEXT NOT NULL DEFAULT 'avg',
    "markup_percent" DECIMAL(5,2),
    "overhead_percent" DECIMAL(5,2),
    "contingency_percent" DECIMAL(5,2),
    "sales_tax_percent" DECIMAL(5,2),
    "proposal_number" TEXT,
    "client_name" TEXT,
    "submitted_at" TIMESTAMP(3),
    "won_at" TIMESTAMP(3),
    "lost_at" TIMESTAMP(3),
    "lost_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_lines" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "classification_id" TEXT,
    "name" TEXT NOT NULL,
    "external_id" TEXT,
    "scope" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "productivity_entry_id" TEXT,
    "labor_trade_id" TEXT,
    "mh_per_unit" DECIMAL(10,4),
    "labor_hours" DECIMAL(12,3),
    "labor_rate_cents" INTEGER,
    "labor_cost_cents" INTEGER,
    "material_cost_cents" INTEGER,
    "material_breakdown" JSONB,
    "waste_percent_override" INTEGER,
    "unit_price_cents" INTEGER,
    "subtotal_cents" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "group_name" TEXT,
    "suggested_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "ai_confidence" INTEGER,
    "user_overridden" BOOLEAN NOT NULL DEFAULT false,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_cost_factors" (
    "id" TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "cost_factor_id" TEXT,
    "name" TEXT NOT NULL,
    "impact_percent" DECIMAL(5,3) NOT NULL,
    "applies_to" TEXT NOT NULL,
    "auto_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_cost_factors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estimates_project_id_key" ON "estimates"("project_id");

-- CreateIndex
CREATE INDEX "estimates_company_id_idx" ON "estimates"("company_id");

-- CreateIndex
CREATE INDEX "estimates_status_idx" ON "estimates"("status");

-- CreateIndex
CREATE INDEX "estimate_lines_company_id_idx" ON "estimate_lines"("company_id");

-- CreateIndex
CREATE INDEX "estimate_lines_estimate_id_idx" ON "estimate_lines"("estimate_id");

-- CreateIndex
CREATE INDEX "estimate_lines_classification_id_idx" ON "estimate_lines"("classification_id");

-- CreateIndex
CREATE INDEX "estimate_cost_factors_estimate_id_idx" ON "estimate_cost_factors"("estimate_id");

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_received_from_id_fkey" FOREIGN KEY ("received_from_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_classification_id_fkey" FOREIGN KEY ("classification_id") REFERENCES "classifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_productivity_entry_id_fkey" FOREIGN KEY ("productivity_entry_id") REFERENCES "productivity_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_labor_trade_id_fkey" FOREIGN KEY ("labor_trade_id") REFERENCES "labor_trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_cost_factors" ADD CONSTRAINT "estimate_cost_factors_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_cost_factors" ADD CONSTRAINT "estimate_cost_factors_cost_factor_id_fkey" FOREIGN KEY ("cost_factor_id") REFERENCES "cost_factors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
