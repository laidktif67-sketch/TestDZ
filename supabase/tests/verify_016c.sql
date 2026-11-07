\ir verify_016b.sql
-- Verify 016c after application.
DO $$
DECLARE
  v_trigger_count integer;
  v_function_count integer;
BEGIN
  IF (SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version='20261107000300') <> 1 THEN
    RAISE EXCEPTION '016c migration history row missing or duplicated';
  END IF;

  WITH expected(trigger_name, table_name) AS (
    VALUES
      ('trg_cohorts_validate_status','cohorts'),
      ('trg_cohorts_sync_is_active','cohorts'),
      ('trg_cohort_tests_capacity','cohort_tests'),
      ('trg_cohorts_check_capacity_update','cohorts'),
      ('trg_cohort_tests_prevent_key_update','cohort_tests'),
      ('trg_assignments_prevent_self_test','assignments')
  )
  SELECT COUNT(*) INTO v_trigger_count
  FROM expected e
  JOIN pg_trigger t
    ON t.tgname=e.trigger_name
   AND t.tgrelid=to_regclass('public.' || e.table_name)
   AND t.tgenabled='O'
   AND NOT t.tgisinternal;

  IF v_trigger_count <> 6 THEN
    RAISE EXCEPTION 'Expected 6 enabled non-internal triggers on the correct tables; found %', v_trigger_count;
  END IF;

  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='private'
    AND p.proname IN (
      'cohorts_validate_status_transition','cohorts_sync_is_active',
      'cohort_tests_capacity','cohorts_check_capacity_update',
      'cohort_tests_prevent_key_update','assignments_prevent_self_test'
    );

  IF v_function_count <> 6 THEN
    RAISE EXCEPTION 'Expected 6 private trigger functions; found %', v_function_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cohorts' AND column_name='test_id'
  ) THEN
    RAISE EXCEPTION 'cohorts.test_id still exists after 016c';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='cohorts'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.cohorts';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='cohorts'
      AND policyname='cohorts_select_participants' AND cmd='SELECT'
  ) THEN
    RAISE EXCEPTION 'cohorts_select_participants policy missing';
  END IF;
END $$;
