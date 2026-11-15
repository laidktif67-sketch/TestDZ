-- ============================================================
-- Migration: 20261107000300_cohort_triggers_data_migration.sql
-- Phase: 016c / 4
-- Purpose: Triggers + data migration + DROP cohorts.test_id + RLS
-- ============================================================

BEGIN;

-- ============================================================
-- PHASE 0: Pre-flight (016a + 016b required)
-- ============================================================
DO $
DECLARE v_cohorts_with_test_id int;
BEGIN
  IF to_regclass('public.cohort_tests') IS NULL THEN
    RAISE EXCEPTION 'cohort_tests not found — 016a required';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname='assignments_cohort_test_tester_unique' 
      AND conrelid='public.assignments'::regclass
  ) THEN
    RAISE EXCEPTION 'assignments new UNIQUE not found — 016b required';
  END IF;
  
  SELECT COUNT(*) INTO v_cohorts_with_test_id 
  FROM public.cohorts WHERE test_id IS NOT NULL;
  
  RAISE NOTICE 'Cohorts with test_id: %', v_cohorts_with_test_id;
END $$;

-- ============================================================
-- PHASE 1: Trigger functions (NOT attached yet)
-- ============================================================

-- 1.1 Status transition (INVOKER — reads OLD/NEW only)
CREATE OR REPLACE FUNCTION private.cohorts_validate_status_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.status='forming' AND NEW.status IN ('ready','cancelled')) OR
    (OLD.status='ready' AND NEW.status IN ('running','cancelled')) OR
    (OLD.status='running' AND NEW.status IN ('completed','cancelled'))
  ) THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION: % -> %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- 1.2 is_active sync (DEFINER — UPDATE cohort_tests bypasses RLS)
CREATE OR REPLACE FUNCTION private.cohorts_sync_is_active()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.cohort_tests 
    SET is_active = (NEW.status IN ('forming', 'ready', 'running'))
    WHERE cohort_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 1.3 Capacity INSERT (DEFINER — read cohorts + cohort_tests bypass RLS)
CREATE OR REPLACE FUNCTION private.cohort_tests_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_status text; v_capacity int; v_count int;
BEGIN
  SELECT status, capacity INTO v_status, v_capacity 
  FROM public.cohorts WHERE id = NEW.cohort_id FOR UPDATE;
  
  IF v_status IS NULL THEN RAISE EXCEPTION 'COHORT_NOT_FOUND'; END IF;
  IF v_status NOT IN ('forming', 'ready') THEN
    RAISE EXCEPTION 'COHORT_NOT_ACCEPTING_MEMBERS: %', v_status;
  END IF;
  
  SELECT COUNT(*) INTO v_count FROM public.cohort_tests WHERE cohort_id = NEW.cohort_id;
  IF v_count >= v_capacity THEN
    RAISE EXCEPTION 'COHORT_FULL: %/%', v_count, v_capacity;
  END IF;
  
  NEW.is_active := true;
  RETURN NEW;
END;
$$;

-- 1.4 Capacity reduction (DEFINER — read cohort_tests bypass RLS)
CREATE OR REPLACE FUNCTION private.cohorts_check_capacity_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_count int;
BEGIN
  IF NEW.capacity < OLD.capacity THEN
    SELECT COUNT(*) INTO v_count FROM public.cohort_tests WHERE cohort_id = NEW.id;
    IF v_count > NEW.capacity THEN
      RAISE EXCEPTION 'CAPACITY_BELOW_MEMBER_COUNT: %/%', v_count, NEW.capacity;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 1.5 Key mutation (INVOKER — OLD/NEW only)
CREATE OR REPLACE FUNCTION private.cohort_tests_prevent_key_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF OLD.cohort_id IS DISTINCT FROM NEW.cohort_id
     OR OLD.test_id IS DISTINCT FROM NEW.test_id
     OR OLD.developer_id IS DISTINCT FROM NEW.developer_id THEN
    RAISE EXCEPTION 'COHORT_TEST_IMMUTABLE_KEYS';
  END IF;
  RETURN NEW;
END;
$$;

-- 1.6 Self-test (DEFINER — read tests bypass RLS)
CREATE OR REPLACE FUNCTION private.assignments_prevent_self_test()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT developer_id INTO v_owner FROM public.tests WHERE id = NEW.test_id;
  IF NOT FOUND OR v_owner IS NULL THEN
    RAISE EXCEPTION 'TEST_NOT_FOUND: %', NEW.test_id;
  END IF;
  IF v_owner = NEW.tester_id THEN
    RAISE EXCEPTION 'SELF_TEST_FORBIDDEN';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.cohorts_validate_status_transition() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.cohorts_sync_is_active() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.cohort_tests_capacity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.cohorts_check_capacity_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.cohort_tests_prevent_key_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.assignments_prevent_self_test() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- PHASE 2: Data migration (BEFORE triggers attached)
-- ============================================================
DO $$
DECLARE
  v_orphan_test int;
  v_wrong_owner int;
  v_conflicting int;
  v_multiple_active int;
  v_test_already_active int;
  v_dev_already_in_cohort int;
  v_capacity_overflow int;
  v_preexisting_mismatch int;
  v_assignment_mismatch int;
BEGIN
  -- Every legacy assignment must point to the test historically attached to its cohort.
  -- Fail closed rather than creating orphaned or semantically incorrect links.
  SELECT COUNT(*) INTO v_assignment_mismatch
  FROM public.assignments a
  JOIN public.cohorts c ON c.id = a.cohort_id
  WHERE c.test_id IS DISTINCT FROM a.test_id;
  IF v_assignment_mismatch > 0 THEN
    RAISE EXCEPTION '016c_CONFLICT: % assignments do not match their cohort legacy test_id; reconcile before migration', v_assignment_mismatch;
  END IF;

  SELECT COUNT(*) INTO v_orphan_test
  FROM public.cohorts c
  WHERE c.test_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.tests t WHERE t.id = c.test_id);
  IF v_orphan_test > 0 THEN
    RAISE EXCEPTION 'Orphan test_id: % cohorts', v_orphan_test;
  END IF;
  
  SELECT COUNT(*) INTO v_wrong_owner
  FROM public.cohorts c
  JOIN public.tests t ON t.id = c.test_id
  WHERE c.test_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = t.developer_id);
  IF v_wrong_owner > 0 THEN
    RAISE EXCEPTION 'Missing developer: % cohorts', v_wrong_owner;
  END IF;
  
  SELECT COUNT(*) INTO v_conflicting
  FROM public.cohorts c
  JOIN public.tests t ON t.id = c.test_id
  JOIN public.cohort_tests ct ON ct.cohort_id = c.id AND ct.test_id = c.test_id
  WHERE c.test_id IS NOT NULL AND ct.developer_id != t.developer_id;
  IF v_conflicting > 0 THEN
    RAISE EXCEPTION 'Conflicting developer_id: % cohorts', v_conflicting;
  END IF;
  
  SELECT COUNT(*) INTO v_multiple_active
  FROM (
    SELECT c.test_id FROM public.cohorts c
    WHERE c.test_id IS NOT NULL AND c.status IN ('forming', 'ready', 'running')
    GROUP BY c.test_id HAVING COUNT(*) > 1
  ) t;
  IF v_multiple_active > 0 THEN
    RAISE EXCEPTION '016c_CONFLICT: Test in multiple active cohorts: %', v_multiple_active;
  END IF;
  
  SELECT COUNT(*) INTO v_test_already_active
  FROM public.cohorts c
  JOIN public.cohort_tests ct ON ct.test_id = c.test_id
  WHERE c.test_id IS NOT NULL
    AND c.status IN ('forming', 'ready', 'running')
    AND ct.is_active = true
    AND ct.cohort_id != c.id;
  IF v_test_already_active > 0 THEN
    RAISE EXCEPTION '016c_CONFLICT: Test already active in another cohort: %', v_test_already_active;
  END IF;
  
  SELECT COUNT(*) INTO v_dev_already_in_cohort
  FROM public.cohorts c
  JOIN public.tests t ON t.id = c.test_id
  JOIN public.cohort_tests ct ON ct.cohort_id = c.id
  WHERE c.test_id IS NOT NULL
    AND ct.developer_id = t.developer_id
    AND ct.test_id != c.test_id;
  IF v_dev_already_in_cohort > 0 THEN
    RAISE EXCEPTION '016c_CONFLICT: Developer already in cohort with different test: %', v_dev_already_in_cohort;
  END IF;
  
  SELECT COUNT(*) INTO v_capacity_overflow
  FROM (
    SELECT c.id, c.capacity,
           COUNT(DISTINCT ct.developer_id) +
           CASE WHEN c.test_id IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1 FROM public.cohort_tests ct2
                  WHERE ct2.cohort_id = c.id AND ct2.test_id = c.test_id
                )
                THEN 1 ELSE 0
           END AS total_devs
    FROM public.cohorts c
    LEFT JOIN public.cohort_tests ct ON ct.cohort_id = c.id
    WHERE c.test_id IS NOT NULL
    GROUP BY c.id, c.capacity, c.test_id
    HAVING COUNT(DISTINCT ct.developer_id) +
           CASE WHEN c.test_id IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1 FROM public.cohort_tests ct2
                  WHERE ct2.cohort_id = c.id AND ct2.test_id = c.test_id
                )
                THEN 1 ELSE 0
           END > c.capacity
  ) overflow;
  IF v_capacity_overflow > 0 THEN
    RAISE EXCEPTION '016c_CONFLICT: Capacity overflow after migration: % cohorts', v_capacity_overflow;
  END IF;
  
  SELECT COUNT(*) INTO v_preexisting_mismatch
  FROM public.cohorts c
  JOIN public.cohort_tests ct ON ct.cohort_id = c.id AND ct.test_id = c.test_id
  WHERE c.test_id IS NOT NULL
    AND ct.is_active != (c.status IN ('forming', 'ready', 'running'));
  IF v_preexisting_mismatch > 0 THEN
    RAISE EXCEPTION '016c_CONFLICT: Pre-existing cohort_tests row has is_active mismatch: % rows. Fix data first.', v_preexisting_mismatch;
  END IF;
  
  RAISE NOTICE '✅ Pre-migration validation passed (8 checks)';
END $$;

INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id, is_active)
SELECT c.id, c.test_id, t.developer_id,
       (c.status IN ('forming', 'ready', 'running'))
FROM public.cohorts c
JOIN public.tests t ON t.id = c.test_id
WHERE c.test_id IS NOT NULL
ON CONFLICT (cohort_id, test_id) DO NOTHING;

DO $migration$
DECLARE
  v_orphans int;
  v_wrong_owner int;
  v_inactive_mismatch int;
  v_preexisting_mismatch int;
  v_preexisting_mismatch_detail text;
BEGIN
  SELECT COUNT(*) INTO v_orphans
  FROM public.cohorts c
  WHERE c.test_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.cohort_tests ct 
                    WHERE ct.cohort_id = c.id AND ct.test_id = c.test_id);
  IF v_orphans > 0 THEN RAISE EXCEPTION 'Migration failed: % orphans', v_orphans; END IF;
  
  SELECT COUNT(*) INTO v_wrong_owner
  FROM public.cohorts c
  JOIN public.tests t ON t.id = c.test_id
  JOIN public.cohort_tests ct ON ct.cohort_id = c.id AND ct.test_id = c.test_id
  WHERE c.test_id IS NOT NULL AND ct.developer_id != t.developer_id;
  IF v_wrong_owner > 0 THEN RAISE EXCEPTION 'Ownership mismatch: % cohorts', v_wrong_owner; END IF;
  
  SELECT COUNT(*) INTO v_inactive_mismatch
  FROM public.cohorts c
  JOIN public.cohort_tests ct ON ct.cohort_id = c.id AND ct.test_id = c.test_id
  WHERE c.test_id IS NOT NULL
    AND ct.is_active != (c.status IN ('forming', 'ready', 'running'));
  IF v_inactive_mismatch > 0 THEN 
    RAISE EXCEPTION 'is_active mismatch on migrated rows: %', v_inactive_mismatch; 
  END IF;
  
  SELECT COUNT(*) INTO v_preexisting_mismatch
  FROM public.cohorts c
  JOIN public.cohort_tests ct ON ct.cohort_id = c.id
  WHERE (c.test_id IS NULL OR ct.test_id != c.test_id)
    AND ct.is_active IS DISTINCT FROM (c.status IN ('forming', 'ready', 'running'));

  IF v_preexisting_mismatch > 0 THEN
    -- Keep the migration non-blocking, but include actionable details in CI logs.
    -- Cap the sample to avoid unbounded log output on large datasets.
    SELECT string_agg(
      format(
        'cohort=%s test=%s current=%s expected=%s status=%s',
        mismatch.cohort_id,
        mismatch.test_id,
        mismatch.current_is_active,
        mismatch.expected_is_active,
        mismatch.status
      ),
      '; ' ORDER BY mismatch.cohort_id, mismatch.test_id
    )
    INTO v_preexisting_mismatch_detail
    FROM (
      SELECT
        c.id AS cohort_id,
        ct.test_id,
        ct.is_active AS current_is_active,
        (c.status IN ('forming', 'ready', 'running')) AS expected_is_active,
        c.status
      FROM public.cohorts c
      JOIN public.cohort_tests ct ON ct.cohort_id = c.id
      WHERE (c.test_id IS NULL OR ct.test_id != c.test_id)
        AND ct.is_active IS DISTINCT FROM (c.status IN ('forming', 'ready', 'running'))
      ORDER BY c.id, ct.test_id
      LIMIT 50
    ) AS mismatch;

    RAISE WARNING
      'Pre-existing is_active mismatches (not migrated): % row(s). First up to 50: [%]',
      v_preexisting_mismatch,
      v_preexisting_mismatch_detail;
  END IF;
  
  RAISE NOTICE '✅ Data migration verified';
END $migration$;

-- The legacy assignments are now checked against the migrated cohort/test links.
-- Add this FK only after 016c has populated cohort_tests, so valid legacy rows survive.
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_cohort_test_fk
  FOREIGN KEY (cohort_id, test_id)
  REFERENCES public.cohort_tests (cohort_id, test_id)
  ON DELETE RESTRICT;

-- ============================================================
-- PHASE 3: Attach triggers
-- ============================================================
CREATE TRIGGER trg_cohorts_validate_status
  BEFORE UPDATE OF status ON public.cohorts
  FOR EACH ROW EXECUTE FUNCTION private.cohorts_validate_status_transition();

CREATE TRIGGER trg_cohorts_sync_is_active
  AFTER UPDATE OF status ON public.cohorts
  FOR EACH ROW EXECUTE FUNCTION private.cohorts_sync_is_active();

CREATE TRIGGER trg_cohort_tests_capacity
  BEFORE INSERT ON public.cohort_tests
  FOR EACH ROW EXECUTE FUNCTION private.cohort_tests_capacity();

CREATE TRIGGER trg_cohorts_check_capacity_update
  BEFORE UPDATE OF capacity ON public.cohorts
  FOR EACH ROW EXECUTE FUNCTION private.cohorts_check_capacity_update();

CREATE TRIGGER trg_cohort_tests_prevent_key_update
  BEFORE UPDATE ON public.cohort_tests
  FOR EACH ROW EXECUTE FUNCTION private.cohort_tests_prevent_key_update();

CREATE TRIGGER trg_assignments_prevent_self_test
  BEFORE INSERT OR UPDATE OF test_id, tester_id ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION private.assignments_prevent_self_test();

-- ============================================================
-- PHASE 4: Drop known dependencies FIRST, then pg_depend check
-- ============================================================
DROP POLICY IF EXISTS "cohorts_select_participants" ON public.cohorts;
ALTER TABLE public.cohorts DROP CONSTRAINT IF EXISTS cohorts_test_id_fkey;
DROP INDEX IF EXISTS public.cohorts_test_id_idx;

DO $$
DECLARE v_deps int; v_detail text;
BEGIN
  SELECT COUNT(*), string_agg(pg_describe_object(d.classid, d.objid, d.objsubid), ', ')
  INTO v_deps, v_detail
  FROM pg_depend d
  WHERE d.refobjid = 'public.cohorts'::regclass
    AND d.refobjsubid = (
      SELECT attnum FROM pg_attribute 
      WHERE attrelid='public.cohorts'::regclass AND attname='test_id'
    );
  IF v_deps > 0 THEN
    RAISE EXCEPTION 'Unexpected dependencies on cohorts.test_id: % [%]', v_deps, v_detail;
  END IF;
  RAISE NOTICE '✅ No remaining dependencies';
END $$;

ALTER TABLE public.cohorts DROP COLUMN test_id;

-- ============================================================
-- PHASE 5: New RLS policy
-- ============================================================
CREATE POLICY "cohorts_select_participants"
  ON public.cohorts FOR SELECT TO authenticated
  USING (
    private.is_admin()
    OR EXISTS (SELECT 1 FROM public.assignments a
               WHERE a.cohort_id = cohorts.id AND a.tester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.cohort_tests ct
               WHERE ct.cohort_id = cohorts.id AND ct.developer_id = auth.uid())
  );

-- ============================================================
-- PHASE 6: Post-flight
-- ============================================================
DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM pg_trigger
  WHERE tgname IN (
    'trg_cohorts_validate_status', 'trg_cohorts_sync_is_active',
    'trg_cohort_tests_capacity', 'trg_cohorts_check_capacity_update',
    'trg_cohort_tests_prevent_key_update', 'trg_assignments_prevent_self_test'
  ) AND tgenabled = 'O';
  IF v_count != 6 THEN RAISE EXCEPTION 'triggers: % / 6 (enabled)', v_count; END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='cohorts' AND column_name='test_id')
  THEN RAISE EXCEPTION 'cohorts.test_id still exists'; END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='cohorts'
                   AND policyname='cohorts_select_participants')
  THEN RAISE EXCEPTION 'RLS policy missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.assignments'::regclass
      AND conname='assignments_cohort_test_fk'
      AND contype='f' AND convalidated
  ) THEN RAISE EXCEPTION 'assignments_cohort_test_fk missing or not validated'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.assignments'::regclass
      AND conname='assignments_cohort_tester_fk'
  ) THEN RAISE EXCEPTION 'Invalid tester-to-developer FK exists'; END IF;
  
  RAISE NOTICE '✅ Migration 016c complete';
END $$;

COMMIT;