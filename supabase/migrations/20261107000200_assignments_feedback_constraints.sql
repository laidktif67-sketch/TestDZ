-- ============================================================
-- Migration: 20261107000200_assignments_feedback_constraints.sql
-- Phase: 016b / 4
-- Purpose: Update assignments constraints + feedback NOT NULL/UNIQUE
-- Depends on: migration 016a (cohort_tests table)
-- Data-safety: verified pre-flight (0 feedback, 0 assignments)
-- ============================================================

BEGIN;

-- ============================================================
-- PHASE 0: Pre-flight
-- ============================================================
DO $$
DECLARE
  v_feedback_total int;
  v_feedback_null int;
  v_feedback_dup int;
BEGIN
  -- Verify 016a applied
  IF to_regclass('public.cohort_tests') IS NULL THEN
    RAISE EXCEPTION 'cohort_tests not found — 016a must be applied first';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname='tests_id_developer_unique' 
      AND conrelid='public.tests'::regclass
  ) THEN
    RAISE EXCEPTION 'tests_id_developer_unique not found — 016a must be applied first';
  END IF;
  
  -- Feedback data compatibility
  SELECT COUNT(*) INTO v_feedback_total FROM public.feedback;
  SELECT COUNT(*) INTO v_feedback_null FROM public.feedback WHERE assignment_id IS NULL;
  SELECT COUNT(*) INTO v_feedback_dup FROM (
    SELECT assignment_id FROM public.feedback 
    WHERE assignment_id IS NOT NULL 
    GROUP BY assignment_id HAVING COUNT(*) > 1
  ) t;
  
  IF v_feedback_null > 0 THEN
    RAISE EXCEPTION 'Cannot SET NOT NULL: % feedback rows with NULL assignment_id', v_feedback_null;
  END IF;
  
  IF v_feedback_dup > 0 THEN
    RAISE EXCEPTION 'Cannot add UNIQUE: % duplicate assignment_ids in feedback', v_feedback_dup;
  END IF;
  
  RAISE NOTICE '✅ Pre-flight: feedback total=%, null=%, dup=%', 
    v_feedback_total, v_feedback_null, v_feedback_dup;
  
  -- Assignments data (informational)
  RAISE NOTICE 'Assignments count: %', (SELECT COUNT(*) FROM public.assignments);
END $$;

-- ============================================================
-- PHASE 1: assignments constraints
-- ============================================================
-- 1.1 Drop old UNIQUE(cohort_id, tester_id)
ALTER TABLE public.assignments 
  DROP CONSTRAINT IF EXISTS assignments_cohort_id_tester_id_key;

-- 1.2 New UNIQUE(cohort_id, test_id, tester_id)
ALTER TABLE public.assignments 
  ADD CONSTRAINT assignments_cohort_test_tester_unique 
  UNIQUE (cohort_id, test_id, tester_id);

-- 1.3 Composite FK: (cohort_id, test_id) → cohort_tests(cohort_id, test_id)
ALTER TABLE public.assignments 
  ADD CONSTRAINT assignments_cohort_test_fk 
  FOREIGN KEY (cohort_id, test_id) 
  REFERENCES public.cohort_tests(cohort_id, test_id)
  ON DELETE RESTRICT;

-- 1.4 Composite FK: (cohort_id, tester_id) → cohort_tests(cohort_id, developer_id)
ALTER TABLE public.assignments 
  ADD CONSTRAINT assignments_cohort_tester_fk 
  FOREIGN KEY (cohort_id, tester_id) 
  REFERENCES public.cohort_tests(cohort_id, developer_id)
  ON DELETE RESTRICT;

-- ============================================================
-- PHASE 2: feedback constraints
-- ============================================================
-- 2.1 NOT NULL
ALTER TABLE public.feedback 
  ALTER COLUMN assignment_id SET NOT NULL;

-- 2.2 UNIQUE (one feedback per assignment)
CREATE UNIQUE INDEX feedback_one_per_assignment 
  ON public.feedback (assignment_id);

-- ============================================================
-- PHASE 3: Post-flight
-- ============================================================
DO $$
DECLARE
  v_count int;
BEGIN
  -- Old constraint gone
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname='assignments_cohort_id_tester_id_key' 
      AND conrelid='public.assignments'::regclass
  ) THEN
    RAISE EXCEPTION 'Old UNIQUE(cohort_id, tester_id) still exists';
  END IF;
  
  -- New UNIQUE exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname='assignments_cohort_test_tester_unique' 
      AND conrelid='public.assignments'::regclass
      AND contype='u'
  ) THEN
    RAISE EXCEPTION 'New UNIQUE missing';
  END IF;
  
  -- FK constraints
  SELECT COUNT(*) INTO v_count FROM pg_constraint
  WHERE conrelid='public.assignments'::regclass
    AND conname IN (
      'assignments_cohort_test_fk',
      'assignments_cohort_tester_fk'
    )
    AND contype='f';
  IF v_count != 2 THEN 
    RAISE EXCEPTION 'assignments FKs: expected 2, got %', v_count; 
  END IF;
  
  -- feedback NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' 
      AND table_name='feedback' 
      AND column_name='assignment_id' 
      AND is_nullable='YES'
  ) THEN
    RAISE EXCEPTION 'feedback.assignment_id still nullable';
  END IF;
  
  -- feedback UNIQUE index
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = ic.relnamespace
    WHERE n.nspname='public' 
      AND ic.relname='feedback_one_per_assignment'
      AND i.indisunique = true
  ) THEN
    RAISE EXCEPTION 'feedback_one_per_assignment UNIQUE index missing';
  END IF;
  
  RAISE NOTICE '✅ Migration 016b complete';
END $$;

COMMIT;
