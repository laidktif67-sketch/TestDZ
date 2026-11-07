BEGIN;
SELECT plan(11);

-- ============================================================
-- TEST 1: 6 triggers on correct tables, enabled
-- ============================================================
SELECT ok(
  (SELECT COUNT(*) FROM pg_trigger
   WHERE ((tgname='trg_cohorts_validate_status' AND tgrelid='public.cohorts'::regclass)
       OR (tgname='trg_cohorts_sync_is_active' AND tgrelid='public.cohorts'::regclass)
       OR (tgname='trg_cohort_tests_capacity' AND tgrelid='public.cohort_tests'::regclass)
       OR (tgname='trg_cohorts_check_capacity_update' AND tgrelid='public.cohorts'::regclass)
       OR (tgname='trg_cohort_tests_prevent_key_update' AND tgrelid='public.cohort_tests'::regclass)
       OR (tgname='trg_assignments_prevent_self_test' AND tgrelid='public.assignments'::regclass))
     AND tgenabled='O' AND NOT tgisinternal) = 6,
  'TEST 1: 6 triggers on correct tables, enabled'
);

-- ============================================================
-- TEST 2: cohorts.test_id dropped
-- ============================================================
SELECT ok(
  NOT EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='cohorts' AND column_name='test_id'),
  'TEST 2: cohorts.test_id dropped'
);

-- ============================================================
-- TEST 3: RLS policy no test_id reference
-- ============================================================
SELECT ok(
  NOT EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname='public' AND tablename='cohorts'
                AND policyname='cohorts_select_participants' AND COALESCE(qual, '') LIKE '%test_id%'),
  'TEST 3: RLS policy no test_id reference'
);

-- ============================================================
-- TEST 4: 4 functions SECURITY DEFINER
-- ============================================================
SELECT ok(
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private'
     AND p.proname IN ('cohorts_sync_is_active','cohort_tests_capacity',
                       'cohorts_check_capacity_update','assignments_prevent_self_test')
     AND p.prosecdef=true) = 4,
  'TEST 4: 4 functions SECURITY DEFINER'
);

-- ============================================================
-- TEST 5: 2 functions SECURITY INVOKER
-- ============================================================
SELECT ok(
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private'
     AND p.proname IN ('cohorts_validate_status_transition','cohort_tests_prevent_key_update')
     AND p.prosecdef=false) = 2,
  'TEST 5: 2 functions SECURITY INVOKER'
);

-- ============================================================
-- TEST 6: All 6 functions revoke EXECUTE from PUBLIC/anon/authenticated
-- ============================================================
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
    WHERE n.nspname='private'
      AND p.proname IN ('cohorts_validate_status_transition','cohorts_sync_is_active',
                        'cohort_tests_capacity','cohorts_check_capacity_update',
                        'cohort_tests_prevent_key_update','assignments_prevent_self_test')
      AND acl.privilege_type='EXECUTE'
      AND (acl.grantee=0 OR (SELECT rolname FROM pg_roles WHERE oid=acl.grantee) IN ('anon','authenticated'))
  ),
  'TEST 6: All 6 functions revoke EXECUTE from PUBLIC/anon/authenticated'
);

-- ============================================================
-- TEST 7: RLS policy exists
-- ============================================================
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies
          WHERE schemaname='public' AND tablename='cohorts'
            AND policyname='cohorts_select_participants'),
  'TEST 7: RLS policy exists'
);

-- ============================================================
-- TEST 8: cohort_tests.is_active exists
-- ============================================================
SELECT ok(
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='cohort_tests' AND column_name='is_active'),
  'TEST 8: cohort_tests.is_active exists'
);

-- ============================================================
-- TEST 9: All 6 functions search_path=""
-- ============================================================
SELECT ok(
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private'
     AND p.proname IN ('cohorts_validate_status_transition','cohorts_sync_is_active',
                       'cohort_tests_capacity','cohorts_check_capacity_update',
                       'cohort_tests_prevent_key_update','assignments_prevent_self_test')
     AND p.proconfig IS NOT NULL
     AND EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg='search_path=""')) = 6,
  'TEST 9: All 6 functions search_path=""'
);

-- ============================================================
-- TEST 10a: exactly 6 functions (no overloads)
-- ============================================================
SELECT ok(
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private'
     AND p.proname IN ('cohorts_validate_status_transition','cohorts_sync_is_active',
                       'cohort_tests_capacity','cohorts_check_capacity_update',
                       'cohort_tests_prevent_key_update','assignments_prevent_self_test')
  ) = 6,
  'TEST 10a: exactly 6 functions (no overloads)'
);

-- ============================================================
-- TEST 10b: no args + trusted owner
-- ============================================================
SELECT ok(
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private'
     AND p.proname IN ('cohorts_validate_status_transition','cohorts_sync_is_active',
                       'cohort_tests_capacity','cohorts_check_capacity_update',
                       'cohort_tests_prevent_key_update','assignments_prevent_self_test')
     AND pg_get_function_arguments(p.oid) = ''
     AND pg_get_userbyid(p.proowner) IN ('postgres','supabase_admin','service_role')
  ) = 6,
  'TEST 10b: no args + trusted owner'
);

SELECT * FROM finish();
ROLLBACK;
