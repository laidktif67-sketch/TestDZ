-- ============================================================
-- Test Suite: migration 016a
-- Asserts cohort_tests table structure + constraints + RLS
-- Note: pgTAP does not provide has_constraint(); using ok(EXISTS(...))
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
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tests'::regclass
      AND conname = 'tests_id_developer_unique'
      AND contype = 'u'
  ),
  'TEST 2: tests_id_developer_unique exists on public.tests'
);

-- ============================================================
-- TEST 3: cohort_tests composite FK to tests
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cohort_tests'::regclass
      AND conname = 'cohort_tests_test_developer_fk'
      AND contype = 'f'
  ),
  'TEST 3: cohort_tests_test_developer_fk exists (composite FK)'
);

-- ============================================================
-- TEST 4: cohort_tests UNIQUE(cohort_id, developer_id)
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cohort_tests'::regclass
      AND conname = 'cohort_tests_developer_unique'
      AND contype = 'u'
  ),
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
  (
    SELECT relrowsecurity 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relname = 'cohort_tests'
  ),
  'TEST 6: RLS enabled on public.cohort_tests'
);

-- ============================================================
-- TEST 7: SELECT policy exists
-- ============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cohort_tests'
      AND policyname = 'cohort_tests_select_participants'
  ),
  'TEST 7: SELECT policy cohort_tests_select_participants exists'
);

SELECT * FROM finish();
ROLLBACK;
