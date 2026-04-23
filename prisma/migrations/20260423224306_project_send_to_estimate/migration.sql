-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "estimate_accepted_at" TIMESTAMP(3),
ADD COLUMN     "estimate_handoff_note" TEXT,
ADD COLUMN     "estimate_receiver_id" TEXT,
ADD COLUMN     "sent_to_estimate_at" TIMESTAMP(3),
ADD COLUMN     "sent_to_estimate_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_sent_to_estimate_by_id_fkey" FOREIGN KEY ("sent_to_estimate_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_estimate_receiver_id_fkey" FOREIGN KEY ("estimate_receiver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
