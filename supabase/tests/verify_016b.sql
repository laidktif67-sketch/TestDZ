\ir verify_016a.sql
-- Verify 016b after application.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version='20261107000200') <> 1 THEN
    RAISE EXCEPTION '016b migration history row missing or duplicated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.assignments'::regclass
      AND conname='assignments_cohort_id_tester_id_key'
  ) THEN
    RAISE EXCEPTION 'Old assignments unique constraint still exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.assignments'::regclass
      AND conname='assignments_cohort_test_tester_unique'
      AND contype='u' AND convalidated
  ) THEN
    RAISE EXCEPTION 'assignments_cohort_test_tester_unique missing or unvalidated';
  END IF;

  IF (
    SELECT COUNT(*) FROM pg_constraint
    WHERE conrelid='public.assignments'::regclass
      AND conname IN ('assignments_cohort_test_fk','assignments_cohort_tester_fk')
      AND contype='f' AND convalidated
      AND (
        (conname='assignments_cohort_test_fk'
          AND position('FOREIGN KEY (cohort_id, test_id)' in pg_get_constraintdef(oid)) > 0)
        OR
        (conname='assignments_cohort_tester_fk'
          AND position('FOREIGN KEY (cohort_id, tester_id)' in pg_get_constraintdef(oid)) > 0)
      )
  ) <> 2 THEN
    RAISE EXCEPTION 'Expected both validated composite assignment FKs with exact column pairs';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='feedback'
      AND column_name='assignment_id' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION 'feedback.assignment_id is still nullable or missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class idx ON idx.oid=i.indexrelid
    JOIN pg_namespace n ON n.oid=idx.relnamespace
    WHERE n.nspname='public' AND idx.relname='feedback_one_per_assignment'
      AND i.indisunique
  ) THEN
    RAISE EXCEPTION 'feedback_one_per_assignment UNIQUE index missing';
  END IF;
END $$;
