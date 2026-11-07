\ir verify_baseline_001_015.sql
-- Verify 016a after application.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version='20261107000100') <> 1 THEN
    RAISE EXCEPTION '016a migration history row missing or duplicated';
  END IF;

  IF to_regclass('public.cohort_tests') IS NULL THEN
    RAISE EXCEPTION 'public.cohort_tests missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.tests'::regclass
      AND conname='tests_id_developer_unique' AND contype='u'
  ) THEN
    RAISE EXCEPTION 'tests_id_developer_unique missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.cohort_tests'::regclass
      AND conname='cohort_tests_pkey' AND contype='p'
  ) THEN
    RAISE EXCEPTION 'cohort_tests primary key missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.cohort_tests'::regclass
      AND conname='cohort_tests_developer_unique' AND contype='u'
  ) THEN
    RAISE EXCEPTION 'cohort_tests_developer_unique missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.cohort_tests'::regclass
      AND conname='cohort_tests_test_developer_fk' AND contype='f'
      AND convalidated
  ) THEN
    RAISE EXCEPTION 'cohort_tests_test_developer_fk missing or unvalidated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class idx ON idx.oid=i.indexrelid
    JOIN pg_namespace n ON n.oid=idx.relnamespace
    WHERE n.nspname='public' AND idx.relname='cohort_tests_test_one_active'
      AND i.indisunique AND i.indpred IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'cohort_tests_test_one_active missing or not partial UNIQUE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='cohort_tests'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.cohort_tests';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cohort_tests'
      AND policyname='cohort_tests_select_participants'
      AND cmd='SELECT'
  ) THEN
    RAISE EXCEPTION 'cohort_tests_select_participants policy missing';
  END IF;

  IF NOT has_table_privilege('authenticated','public.cohort_tests','SELECT')
     OR has_table_privilege('authenticated','public.cohort_tests','INSERT')
     OR has_table_privilege('authenticated','public.cohort_tests','UPDATE')
     OR has_table_privilege('authenticated','public.cohort_tests','DELETE') THEN
    RAISE EXCEPTION 'cohort_tests grants do not match SELECT-only access';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cohorts' AND column_name='test_id'
  ) THEN
    RAISE EXCEPTION 'cohorts.test_id should remain until 016c';
  END IF;
END $$;
