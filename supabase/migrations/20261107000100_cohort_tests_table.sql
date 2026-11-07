-- ============================================================
-- Migration: 20261107000100_cohort_tests_table.sql
-- Phase: 016a / 4
-- Purpose: Create cohort_tests junction table + tests composite unique
-- Data-safety: works on empty AND populated databases
-- Does NOT touch: cohorts.test_id (deferred to 016c)
-- ============================================================

BEGIN;

-- ============================================================
-- PHASE 0: Pre-flight (data-compatible check)
-- ============================================================
DO $$
DECLARE
  v_cohorts_count int;
  v_tests_count int;
  v_conflicts int;
BEGIN
  -- 1. Verify prerequisites
  IF to_regclass('public.tests') IS NULL THEN
    RAISE EXCEPTION 'tests table not found';
  END IF;
  IF to_regclass('public.cohorts') IS NULL THEN
    RAISE EXCEPTION 'cohorts table not found';
  END IF;
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'profiles table not found';
  END IF;
  IF to_regprocedure('private.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'private.is_admin() not found';
  END IF;
  
  -- 2. Idempotency: abort cleanly if already applied
  IF to_regclass('public.cohort_tests') IS NOT NULL THEN
    RAISE EXCEPTION 'cohort_tests already exists — 016a may have run';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname='tests_id_developer_unique' 
      AND conrelid='public.tests'::regclass
  ) THEN
    RAISE EXCEPTION 'tests_id_developer_unique already exists — 016a may have run';
  END IF;
  
  -- 3. Data compatibility: composite key duplicates in tests
  -- (technically impossible since id is PK, but hygiene check)
  SELECT COUNT(*) INTO v_conflicts
  FROM (
    SELECT id, developer_id FROM public.tests 
    GROUP BY id, developer_id HAVING COUNT(*) > 1
  ) t;
  
  IF v_conflicts > 0 THEN
    RAISE EXCEPTION 'Cannot add UNIQUE(id, developer_id): % duplicate rows in tests', v_conflicts;
  END IF;
  
  -- 4. Warnings (not blockers): existing data
  SELECT COUNT(*) INTO v_cohorts_count FROM public.cohorts;
  SELECT COUNT(*) INTO v_tests_count FROM public.tests;
  
  IF v_cohorts_count > 0 THEN
    RAISE WARNING 'Found % existing cohorts — 016c will migrate their test_id links', v_cohorts_count;
  END IF;
  
  IF v_tests_count > 0 THEN
    RAISE WARNING 'Found % existing tests — cohort_tests will be empty initially', v_tests_count;
  END IF;
  
  RAISE NOTICE '✅ Pre-flight passed';
END $$;

-- ============================================================
-- PHASE 1: tests composite unique (required for FK from cohort_tests)
-- ============================================================
ALTER TABLE public.tests 
  ADD CONSTRAINT tests_id_developer_unique UNIQUE (id, developer_id);

-- ============================================================
-- PHASE 2: cohort_tests table
-- ============================================================
CREATE TABLE public.cohort_tests (
  cohort_id    uuid NOT NULL REFERENCES public.cohorts(id) ON DELETE RESTRICT,
  test_id      uuid NOT NULL REFERENCES public.tests(id) ON DELETE RESTRICT,
  developer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  is_active    boolean NOT NULL DEFAULT true,
  added_at     timestamptz NOT NULL DEFAULT now(),
  
  PRIMARY KEY (cohort_id, test_id),
  
  -- One developer = one test per cohort
  CONSTRAINT cohort_tests_developer_unique 
    UNIQUE (cohort_id, developer_id),
  
  -- Developer MUST own the test (composite FK)
  CONSTRAINT cohort_tests_test_developer_fk 
    FOREIGN KEY (test_id, developer_id) 
    REFERENCES public.tests(id, developer_id)
);

-- NOTE on is_active:
-- In 016a, is_active defaults to true and is NOT synchronized with cohorts.status.
-- 016c will add a trigger to sync it. Until then, cohort_tests will be empty
-- (no RPC in 016a/016b to insert), so this is safe.

-- ============================================================
-- PHASE 3: Partial unique index — test in at most ONE active cohort
-- ============================================================
CREATE UNIQUE INDEX cohort_tests_test_one_active 
  ON public.cohort_tests (test_id) 
  WHERE is_active = true;

-- ============================================================
-- PHASE 4: RLS + GRANTs (minimal privileges)
-- ============================================================
ALTER TABLE public.cohort_tests ENABLE ROW LEVEL SECURITY;

-- Revoke ALL (includes PUBLIC, anon, authenticated)
REVOKE ALL ON public.cohort_tests FROM PUBLIC, anon, authenticated;

-- Grant SELECT only — writes via RPCs (016d)
GRANT SELECT ON public.cohort_tests TO authenticated;

-- SELECT policy: admin OR developer OR tester
CREATE POLICY "cohort_tests_select_participants"
  ON public.cohort_tests 
  FOR SELECT 
  TO authenticated
  USING (
    private.is_admin()
    OR developer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.cohort_id = cohort_tests.cohort_id 
        AND a.tester_id = auth.uid()
    )
  );

-- ============================================================
-- PHASE 5: Post-flight (schema-scoped verification)
-- ============================================================
DO $$
DECLARE v_count int;
BEGIN
  -- cohort_tests exists
  IF to_regclass('public.cohort_tests') IS NULL THEN
    RAISE EXCEPTION 'cohort_tests not created';
  END IF;
  
  -- tests_id_developer_unique exists (scoped to public.tests)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname='tests_id_developer_unique' 
      AND conrelid='public.tests'::regclass
  ) THEN
    RAISE EXCEPTION 'tests_id_developer_unique missing';
  END IF;
  
  -- cohort_tests constraints: pkey + developer_unique + test_developer_fk
  SELECT COUNT(*) INTO v_count FROM pg_constraint
  WHERE conrelid='public.cohort_tests'::regclass
    AND contype IN ('p','u','f');
  IF v_count < 3 THEN
    RAISE EXCEPTION 'cohort_tests constraints: expected >=3, got %', v_count;
  END IF;
  
  -- Partial unique index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname='public' 
      AND tablename='cohort_tests' 
      AND indexname='cohort_tests_test_one_active'
  ) THEN
    RAISE EXCEPTION 'cohort_tests_test_one_active missing';
  END IF;
  
  -- RLS enabled (scoped to public.cohort_tests)
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' 
      AND c.relname='cohort_tests' 
      AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on public.cohort_tests';
  END IF;
  
  -- RLS policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='cohort_tests' 
      AND policyname='cohort_tests_select_participants'
  ) THEN
    RAISE EXCEPTION 'RLS policy missing';
  END IF;
  
  -- Ensure cohorts.test_id still exists (016a must NOT touch it)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' 
      AND table_name='cohorts' 
      AND column_name='test_id'
  ) THEN
    RAISE EXCEPTION 'cohorts.test_id was unexpectedly dropped — 016a should NOT touch it';
  END IF;
  
  RAISE NOTICE '✅ Migration 016a complete: cohort_tests created (data-safe, cohorts.test_id preserved)';
END $$;

COMMIT;
