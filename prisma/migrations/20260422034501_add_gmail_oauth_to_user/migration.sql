-- AlterTable
ALTER TABLE "users" ADD COLUMN     "gmail_connected_at" TIMESTAMP(3),
ADD COLUMN     "gmail_email" TEXT,
ADD COLUMN     "gmail_history_id" TEXT,
ADD COLUMN     "gmail_last_sync_at" TIMESTAMP(3),
ADD COLUMN     "gmail_refresh_token" TEXT;
