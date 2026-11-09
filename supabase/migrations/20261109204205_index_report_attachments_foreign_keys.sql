-- Migration 005: add covering indexes for report_attachments foreign keys.
-- No row data is modified.

BEGIN;

CREATE INDEX report_attachments_report_assignment_idx
  ON public.report_attachments (report_id, assignment_id);

CREATE INDEX report_attachments_assignment_test_tester_idx
  ON public.report_attachments (assignment_id, test_id, tester_id);

CREATE INDEX report_attachments_tester_id_idx
  ON public.report_attachments (tester_id);

DO $postflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'report_attachments'
      AND indexname = 'report_attachments_report_assignment_idx'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'report_attachments'
      AND indexname = 'report_attachments_assignment_test_tester_idx'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'report_attachments'
      AND indexname = 'report_attachments_tester_id_idx'
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: one or more report_attachments FK indexes are missing';
  END IF;
END
$postflight$;

COMMIT;
