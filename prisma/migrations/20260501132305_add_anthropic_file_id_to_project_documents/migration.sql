-- ============================================================
-- ProjectDocument.anthropic_file_id
-- ============================================================
-- Caches the Anthropic Files API id for each PDF so we don't
-- re-upload the same document on every analysis run. Lazy-populated:
-- the first analysis run that references a document uploads it to
-- Anthropic and stores the file_id back here.
--
-- file_id format: "file_011..." — keeping as TEXT for forward
-- compatibility with potential id format changes.
-- ============================================================

ALTER TABLE "project_documents"
  ADD COLUMN "anthropic_file_id" TEXT;
