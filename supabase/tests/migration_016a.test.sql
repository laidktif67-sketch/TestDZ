-- ============================================================
-- Test Suite: migration 016a
-- Asserts cohort_tests table structure + constraints + RLS
-- ============================================================

BEGIN;
SELECT plan(7);

-- ============================================================
-- TEST 1: cohort_tests table exists
-- ============================================================
SELECT has_table(
  'public', 'cohort_tests',
  'TEST 1: cohort_tests table exists'
);

-- ============================================================
-- TEST 2: tests_id_developer_unique constraint exists
-- ============================================================
SELECT has_constraint(
  'tests', 'tests_id_developer_unique',
  'TEST 2: tests_id_developer_unique exists on tests'
);

-- ============================================================
-- TEST 3: cohort_tests composite FK to tests
-- ============================================================
SELECT has_constraint(
  'cohort_tests', 'cohort_tests_test_developer_fk',
  'TEST 3: cohort_tests_test_developer_fk exists'
);

-- ============================================================
-- TEST 4: cohort_tests UNIQUE(cohort_id, developer_id)
-- ============================================================
SELECT has_constraint(
  'cohort_tests', 'cohort_tests_developer_unique',
  'TEST 4: cohort_tests_developer_unique exists'
);

-- ============================================================
-- TEST 5: partial unique index on (test_id) WHERE is_active
-- ============================================================
SELECT has_index(
  'public', 'cohort_tests', 'cohort_tests_test_one_active',
  'TEST 5: partial unique index cohort_tests_test_one_active exists'
);

-- ============================================================
-- TEST 6: RLS enabled on cohort_tests
-- ============================================================
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname='public' AND c.relname='cohort_tests'),
  'TEST 6: RLS enabled on public.cohort_tests'
);

-- ============================================================
-- TEST 7: SELECT policy exists
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='cohort_tests' 
      AND policyname='cohort_tests_select_participants'
  ),
  'TEST 7: SELECT policy cohort_tests_select_participants exists'
);

SELECT * FROM finish();
ROLLBACK;
