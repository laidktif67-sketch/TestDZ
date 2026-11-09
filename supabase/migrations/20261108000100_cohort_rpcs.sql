-- ============================================================
-- Migration: 20261108000100_cohort_rpcs.sql
-- Phase: 016d / 4
-- Purpose: Admin-only atomic cohort creation and forming-cohort edits.
-- Requires: 016a, 016b, 016c.
-- ============================================================

BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.cohort_tests') IS NULL
     OR to_regclass('public.assignments') IS NULL
     OR to_regclass('public.feedback') IS NULL
     OR to_regprocedure('private.is_admin()') IS NULL THEN
    RAISE EXCEPTION '016d prerequisites missing (016a/016b/016c required)';
  END IF;
  IF to_regclass('public.cohorts') IS NULL
     OR to_regclass('public.tests') IS NULL
     OR to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION '016d core tables missing';
  END IF;
END
$preflight$;

-- Create a complete cohort only: exactly 13 tests owned by 13 distinct developers.
-- PostgreSQL executes each function call in the caller's transaction; no nested
-- BEGIN/COMMIT is used here. Any exception rolls back the entire RPC call.
CREATE OR REPLACE FUNCTION public.create_cohort(
  p_name text,
  p_capacity integer,
  p_test_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_cohort_id uuid;
  v_test_count integer;
  v_owner_count integer;
  v_inserted integer;
  v_assignment_count integer;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'INVALID_COHORT_NAME';
  END IF;
  IF p_capacity IS DISTINCT FROM 13 THEN
    RAISE EXCEPTION 'INVALID_CAPACITY: expected 13';
  END IF;
  IF p_test_ids IS NULL OR pg_catalog.cardinality(p_test_ids) <> 13 THEN
    RAISE EXCEPTION 'INCOMPLETE_COHORT: exactly 13 test_ids are required';
  END IF;

  IF (SELECT pg_catalog.count(DISTINCT x.test_id)
      FROM pg_catalog.unnest(p_test_ids) AS x(test_id)) <> 13 THEN
    RAISE EXCEPTION 'DUPLICATE_TESTS';
  END IF;

  -- Lock the selected test rows in deterministic order before validating ownership.
  PERFORM 1
  FROM public.tests AS t
  WHERE t.id = ANY (p_test_ids)
  ORDER BY t.id
  FOR UPDATE;

  SELECT pg_catalog.count(*), pg_catalog.count(DISTINCT t.developer_id)
    INTO v_test_count, v_owner_count
  FROM public.tests AS t
  WHERE t.id = ANY (p_test_ids);

  IF v_test_count <> 13 THEN
    RAISE EXCEPTION 'TEST_NOT_FOUND: expected 13 existing tests, found %', v_test_count;
  END IF;
  IF v_owner_count <> 13 THEN
    RAISE EXCEPTION 'DUPLICATE_DEVELOPERS: all 13 tests must have different owners';
  END IF;

  INSERT INTO public.cohorts (name, capacity, status)
  VALUES (pg_catalog.btrim(p_name), 13, 'forming')
  RETURNING id INTO v_cohort_id;

  -- The 016c capacity trigger locks this cohort row and enforces forming/capacity.
  INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id, is_active)
  SELECT v_cohort_id, t.id, t.developer_id, true
  FROM public.tests AS t
  WHERE t.id = ANY (p_test_ids);

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted <> 13 THEN
    RAISE EXCEPTION 'COHORT_TEST_INSERT_MISMATCH: expected 13, inserted %', v_inserted;
  END IF;

  -- Every test is assigned to every other developer in this cohort, never its owner.
  INSERT INTO public.assignments (cohort_id, test_id, tester_id)
  SELECT test_row.cohort_id, test_row.test_id, tester_row.developer_id
  FROM public.cohort_tests AS test_row
  JOIN public.cohort_tests AS tester_row
    ON tester_row.cohort_id = test_row.cohort_id
   AND tester_row.developer_id <> test_row.developer_id
  WHERE test_row.cohort_id = v_cohort_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  SELECT pg_catalog.count(*) INTO v_assignment_count
  FROM public.assignments AS a
  WHERE a.cohort_id = v_cohort_id;

  IF v_inserted <> 156 OR v_assignment_count <> 156 THEN
    RAISE EXCEPTION 'ASSIGNMENT_COUNT_MISMATCH: expected 156, inserted %, total %',
      v_inserted, v_assignment_count;
  END IF;

  RETURN v_cohort_id;
END;
$function$;

-- Add one new test and its previously-unrepresented owner to a PARTIAL forming
-- cohort. With 12 existing members this creates exactly 24 assignments:
-- 12 testers for the new test + the new owner testing the 12 existing tests.
-- For smaller partial cohorts the correct delta is 2 * current_member_count.
CREATE OR REPLACE FUNCTION public.add_cohort_test(
  p_cohort_id uuid,
  p_test_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_status text;
  v_capacity integer;
  v_member_count integer;
  v_owner_id uuid;
  v_inserted integer;
  v_expected integer;
  v_existing_assignments integer;
  v_total_assignments integer;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501';
  END IF;

  SELECT c.status, c.capacity
    INTO v_status, v_capacity
  FROM public.cohorts AS c
  WHERE c.id = p_cohort_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COHORT_NOT_FOUND';
  END IF;
  IF v_status <> 'forming' THEN
    RAISE EXCEPTION 'NOT_FORMING';
  END IF;

  SELECT pg_catalog.count(*) INTO v_member_count
  FROM public.cohort_tests AS ct
  WHERE ct.cohort_id = p_cohort_id;

  IF v_member_count >= v_capacity OR v_member_count >= 13 THEN
    RAISE EXCEPTION 'COHORT_FULL: %/%', v_member_count, v_capacity;
  END IF;
  IF v_capacity <> 13 THEN
    RAISE EXCEPTION 'INVALID_CAPACITY: expected 13';
  END IF;

  SELECT pg_catalog.count(*) INTO v_existing_assignments
  FROM public.assignments AS a
  WHERE a.cohort_id = p_cohort_id;
  IF v_existing_assignments <> v_member_count * (v_member_count - 1) THEN
    RAISE EXCEPTION 'ASSIGNMENT_MATRIX_INCOMPLETE: expected %, found %',
      v_member_count * (v_member_count - 1), v_existing_assignments;
  END IF;

  SELECT t.developer_id INTO v_owner_id
  FROM public.tests AS t
  WHERE t.id = p_test_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEST_NOT_FOUND';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.cohort_tests AS ct
    WHERE ct.cohort_id = p_cohort_id
      AND (ct.test_id = p_test_id OR ct.developer_id = v_owner_id)
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_DEVELOPERS_OR_TEST';
  END IF;

  INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id, is_active)
  VALUES (p_cohort_id, p_test_id, v_owner_id, true);

  -- Insert only the new edges. The self-test trigger and composite FKs remain
  -- independent last-line protections.
  INSERT INTO public.assignments (cohort_id, test_id, tester_id)
  SELECT p_cohort_id, p_test_id, ct.developer_id
  FROM public.cohort_tests AS ct
  WHERE ct.cohort_id = p_cohort_id
    AND ct.test_id <> p_test_id
  UNION ALL
  SELECT p_cohort_id, ct.test_id, v_owner_id
  FROM public.cohort_tests AS ct
  WHERE ct.cohort_id = p_cohort_id
    AND ct.test_id <> p_test_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  v_expected := 2 * v_member_count;

  SELECT pg_catalog.count(*) INTO v_total_assignments
  FROM public.assignments AS a
  WHERE a.cohort_id = p_cohort_id;

  IF v_inserted <> v_expected
     OR v_total_assignments <> (v_member_count + 1) * v_member_count THEN
    RAISE EXCEPTION 'ASSIGNMENT_COUNT_MISMATCH: expected delta %, inserted %, total %',
      v_expected, v_inserted, v_total_assignments;
  END IF;

  RETURN v_inserted;
END;
$function$;

-- Remove one test from a forming cohort. Assignments are removed only when
-- they have no feedback, check-ins, play-opt-in events, or non-pending activity.
-- This prevents cascading deletion of user-submitted/history records.
CREATE OR REPLACE FUNCTION public.remove_cohort_test(
  p_cohort_id uuid,
  p_test_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_status text;
  v_owner_id uuid;
  v_member_count integer;
  v_expected integer;
  v_deleted integer;
  v_member_deleted integer;
  v_existing_assignments integer;
  v_total_assignments integer;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'ADMIN_ONLY' USING ERRCODE = '42501';
  END IF;

  SELECT c.status INTO v_status
  FROM public.cohorts AS c
  WHERE c.id = p_cohort_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COHORT_NOT_FOUND';
  END IF;
  IF v_status <> 'forming' THEN
    RAISE EXCEPTION 'NOT_FORMING';
  END IF;

  SELECT ct.developer_id INTO v_owner_id
  FROM public.cohort_tests AS ct
  WHERE ct.cohort_id = p_cohort_id
    AND ct.test_id = p_test_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COHORT_TEST_NOT_FOUND';
  END IF;

  SELECT pg_catalog.count(*) INTO v_member_count
  FROM public.cohort_tests AS ct
  WHERE ct.cohort_id = p_cohort_id;
  v_expected := 2 * (v_member_count - 1);

  SELECT pg_catalog.count(*) INTO v_existing_assignments
  FROM public.assignments AS a
  WHERE a.cohort_id = p_cohort_id;
  IF v_existing_assignments <> v_member_count * (v_member_count - 1) THEN
    RAISE EXCEPTION 'ASSIGNMENT_MATRIX_INCOMPLETE: expected %, found %',
      v_member_count * (v_member_count - 1), v_existing_assignments;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.assignments AS a
    JOIN public.feedback AS f ON f.assignment_id = a.id
    WHERE a.cohort_id = p_cohort_id
      AND (a.test_id = p_test_id OR a.tester_id = v_owner_id)
  ) THEN
    RAISE EXCEPTION 'HAS_FEEDBACK';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.assignments AS a
    JOIN public.checkins AS ch ON ch.assignment_id = a.id
    WHERE a.cohort_id = p_cohort_id
      AND (a.test_id = p_test_id OR a.tester_id = v_owner_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.assignments AS a
    JOIN public.play_opt_in_events AS e ON e.assignment_id = a.id
    WHERE a.cohort_id = p_cohort_id
      AND (a.test_id = p_test_id OR a.tester_id = v_owner_id)
  ) OR EXISTS (
    SELECT 1 FROM public.assignments AS a
    WHERE a.cohort_id = p_cohort_id
      AND (a.test_id = p_test_id OR a.tester_id = v_owner_id)
      AND a.status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'HAS_ACTIVITY: assignment history must be preserved';
  END IF;

  DELETE FROM public.assignments AS a
  WHERE a.cohort_id = p_cohort_id
    AND (a.test_id = p_test_id OR a.tester_id = v_owner_id);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> v_expected THEN
    RAISE EXCEPTION 'ASSIGNMENT_COUNT_MISMATCH: expected to delete %, deleted %',
      v_expected, v_deleted;
  END IF;

  DELETE FROM public.cohort_tests AS ct
  WHERE ct.cohort_id = p_cohort_id
    AND ct.test_id = p_test_id;

  GET DIAGNOSTICS v_member_deleted = ROW_COUNT;
  IF v_member_deleted <> 1 THEN
    RAISE EXCEPTION 'COHORT_TEST_DELETE_MISMATCH: expected 1, deleted %',
      v_member_deleted;
  END IF;

  SELECT pg_catalog.count(*) INTO v_total_assignments
  FROM public.assignments AS a
  WHERE a.cohort_id = p_cohort_id;
  IF v_total_assignments <> (v_member_count - 1) * (v_member_count - 2) THEN
    RAISE EXCEPTION 'ASSIGNMENT_COUNT_MISMATCH: expected remaining %, found %',
      (v_member_count - 1) * (v_member_count - 2), v_total_assignments;
  END IF;

  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_cohort(text, integer, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_cohort_test(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_cohort_test(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_cohort(text, integer, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_cohort_test(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_cohort_test(uuid, uuid) TO authenticated;

COMMIT;
