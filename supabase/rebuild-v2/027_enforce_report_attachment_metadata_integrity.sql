-- Enforce canonical, non-null V2 report attachment metadata.
-- Candidate-only migration; replayed only on disposable local Supabase.
BEGIN;

ALTER TABLE rebuild_v2.report_attachments
  ALTER COLUMN storage_path SET NOT NULL;

ALTER TABLE rebuild_v2.report_attachments
  ADD CONSTRAINT report_attachments_file_extension_allowed_check
  CHECK (file_extension = ANY (ARRAY['png','jpg','jpeg','webp','txt','pdf','zip']::text[]));

ALTER TABLE rebuild_v2.report_attachments
  ADD CONSTRAINT report_attachments_storage_path_canonical_check
  CHECK (
    storage_path =
      'v2/' || test_id::text || '/' || tester_id::text || '/' ||
      report_id::text || '/' || file_id::text || '.' || file_extension
  );

COMMIT;
