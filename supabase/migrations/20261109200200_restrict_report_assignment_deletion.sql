-- ============================================================
-- Migration: 20261109200200_restrict_report_assignment_deletion.sql
-- Purpose:
--   Preserve report-to-assignment audit history by preventing deletion
--   of assignments referenced by reports, and make cohort-test removal
--   fail with an explicit error when affected assignments have reports.
-- Environment: Staging / Pre-Production
-- Safety: DDL and RPC replacement are transactional; no data is modified.
-- ============================================================

BEGIN;

-- ============================================================
-- PHASE 0: Pre-flight
-- ============================================================
DO $preflight$
DECLARE
  v_delete_action "char";
BEGIN
  IF to_regclass('public.reports') IS NULL
     OR to_regclass('public.assignments') IS NULL
     OR to_regclass('public.cohort_tests') IS NULL
     OR to_regclass('public.cohorts') IS NULL THEN
    RAISE EXCEPTION 'RESTRICT_REPORT_ASSIGNMENT_PREREQUISITES_MISSING';
  END IF;

  IF to_regprocedure('public.remove_cohort_test(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'REMOVE_COHORT_TEST_RPC_MISSING';
  END IF;

  SELECT confdeltype
    INTO v_delete_action
  FROM pg_constraint
  WHERE conrelid = 'public.reports'::regclass
    AND conname = 'reports_assignment_id_fkey'
    AND contype = 'f'
    AND confrelid = 'public.assignments'::regclass;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reports_assignment_id_fkey missing or does not reference assignments';
  END IF;

  -- PostgreSQL FK delete actions: a=NO ACTION, r=RESTRICT, c=CASCADE,
  -- n=SET NULL, d=SET DEFAULT.
  IF v_delete_action <> 'n' AND v_delete_action <> 'r' THEN
    RAISE EXCEPTION
      'Unexpected reports_assignment_id_fkey delete action: % (expected SET NULL or RESTRICT)',
      v_delete_action;
  END IF;
END
$preflight$;

-- ============================================================
-- PHASE 1: Preserve report history at the FK boundary
-- ============================================================
ALTER TABLE public.reports
  DROP CONSTRAINT reports_assignment_id_fkey;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_assignment_id_fkey
  FOREIGN KEY (assignment_id)
  REFERENCES public.assignments(id)
  ON DELETE RESTRICT;

-- ============================================================
-- PHASE 2: Make the cohort removal RPC report-aware
-- ============================================================
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

  -- Reports are durable audit records. Do not detach them or delete
  -- their referenced assignments during cohort membership removal.
  IF EXISTS (
    SELECT 1
    FROM public.assignments AS a
    JOIN public.reports AS r ON r.assignment_id = a.id
    WHERE a.cohort_id = p_cohort_id
      AND (a.test_id = p_test_id OR a.tester_id = v_owner_id)
  ) THEN
    RAISE EXCEPTION 'HAS_REPORTS: assignment history must be preserved';
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

-- Preserve the existing RPC execution boundary from migration 016d.
REVOKE ALL ON FUNCTION public.remove_cohort_test(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_cohort_test(uuid, uuid)
  TO authenticated;

-- ============================================================
-- PHASE 3: Post-flight
-- ============================================================
DO $postflight$
DECLARE
  v_delete_action "char";
  v_definition text;
BEGIN
  SELECT confdeltype
    INTO v_delete_action
  FROM pg_constraint
  WHERE conrelid = 'public.reports'::regclass
    AND conname = 'reports_assignment_id_fkey'
    AND contype = 'f'
    AND confrelid = 'public.assignments'::regclass;

  IF NOT FOUND OR v_delete_action <> 'r' THEN
    RAISE EXCEPTION 'reports_assignment_id_fkey is not ON DELETE RESTRICT';
  END IF;

  SELECT pg_get_functiondef('public.remove_cohort_test(uuid,uuid)'::regprocedure)
    INTO v_definition;

  IF position('HAS_REPORTS' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'remove_cohort_test is missing HAS_REPORTS protection';
  END IF;

  IF NOT has_function_privilege('authenticated',
       'public.remove_cohort_test(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('anon',
       'public.remove_cohort_test(uuid,uuid)', 'EXECUTE')
     OR EXISTS (
       SELECT 1
       FROM pg_proc AS p
       CROSS JOIN LATERAL aclexplode(
         coalesce(p.proacl, acldefault('f', p.proowner))
       ) AS acl
       WHERE p.oid = 'public.remove_cohort_test(uuid,uuid)'::regprocedure
         AND acl.grantee = 0
         AND acl.privilege_type = 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'remove_cohort_test execution grants are incorrect';
  END IF;
END
$postflight$;

COMMIT;
