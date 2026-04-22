-- CreateTable
CREATE TABLE "bid_extractions" (
    "id" TEXT NOT NULL,
    "bid_id" TEXT,
    "raw_email" TEXT NOT NULL,
    "email_subject" TEXT,
    "from_address" TEXT,
    "extracted_data" JSONB NOT NULL,
    "confidence" DECIMAL(5,2),
    "flags" JSONB,
    "summary" TEXT,
    "model_used" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cache_read_tokens" INTEGER,
    "cost_cents" DECIMAL(10,4),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "extracted_by" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_extractions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bid_extractions" ADD CONSTRAINT "bid_extractions_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_extractions" ADD CONSTRAINT "bid_extractions_extracted_by_fkey" FOREIGN KEY ("extracted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
