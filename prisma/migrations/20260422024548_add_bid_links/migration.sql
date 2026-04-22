-- CreateTable
CREATE TABLE "bid_links" (
    "id" TEXT NOT NULL,
    "bid_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "category" TEXT,
    "source" TEXT NOT NULL DEFAULT 'email_ai',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_links_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bid_links" ADD CONSTRAINT "bid_links_bid_id_fkey" FOREIGN KEY ("bid_id") REFERENCES "bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;
