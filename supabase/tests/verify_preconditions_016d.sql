-- Read-only preconditions for 016d. All three RPCs must still be absent.
DO $verify$
DECLARE v_count integer;
BEGIN
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>18 THEN RAISE EXCEPTION 'Expected exactly 18 migration history rows before 016d'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261107000100')<>1 THEN RAISE EXCEPTION '016a must be recorded exactly once before 016d'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261107000200')<>1 THEN RAISE EXCEPTION '016b must be recorded exactly once before 016d'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261107000300')<>1 THEN RAISE EXCEPTION '016c must be recorded exactly once before 016d'; END IF;
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261108000100') THEN RAISE EXCEPTION '016d is already recorded; refusing duplicate application'; END IF;
 IF to_regclass('public.cohort_tests') IS NULL OR to_regclass('public.assignments') IS NULL
 OR to_regclass('public.feedback') IS NULL OR to_regclass('public.checkins') IS NULL
 OR to_regclass('public.play_opt_in_events') IS NULL OR to_regclass('public.cohorts') IS NULL
 OR to_regclass('public.tests') IS NULL OR to_regprocedure('private.is_admin()') IS NULL THEN
  RAISE EXCEPTION '016d prerequisite schema objects are missing';
 END IF;
 IF to_regprocedure('public.create_cohort(text,integer,uuid[])') IS NOT NULL
 OR to_regprocedure('public.add_cohort_test(uuid,uuid)') IS NOT NULL
 OR to_regprocedure('public.remove_cohort_test(uuid,uuid)') IS NOT NULL THEN
  RAISE EXCEPTION 'One or more 016d RPCs already exist before migration';
 END IF;
 SELECT count(*) INTO v_count FROM pg_roles WHERE rolname='authenticated';
 IF v_count<>1 THEN RAISE EXCEPTION 'Expected authenticated database role'; END IF;
END
$verify$;
