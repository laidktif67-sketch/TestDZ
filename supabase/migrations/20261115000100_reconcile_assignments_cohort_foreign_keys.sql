-- Forward-only reconciliation for the Week 5 assignments/cohort foreign keys.
-- Safe to run after 016c on databases where the invalid legacy FK survived.
-- This migration intentionally fails closed if the named constraint has an
-- unexpected definition or if assignments cannot be matched to cohort_tests.

BEGIN;

DO $reconcile$
DECLARE
  v_source_columns text[];
  v_target_columns text[];
  v_target_table oid;
  v_orphans bigint;
  v_constraint_type "char";
  v_validated boolean;
BEGIN
  IF to_regclass('public.assignments') IS NULL
     OR to_regclass('public.cohort_tests') IS NULL THEN
    RAISE EXCEPTION 'Required tables missing: public.assignments and public.cohort_tests must exist';
  END IF;

  -- Drop the known invalid constraint only when its full definition matches
  -- the specific tester_id -> developer_id mistake documented in the audit.
  SELECT c.contype, c.confrelid, c.convalidated
    INTO v_constraint_type, v_target_table, v_validated
  FROM pg_constraint c
  WHERE c.conrelid = 'public.assignments'::regclass
    AND c.conname = 'assignments_cohort_tester_fk';

  IF FOUND THEN
    SELECT array_agg(a.attname::text ORDER BY k.ord)
      INTO v_source_columns
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.assignments'::regclass
      AND c.conname = 'assignments_cohort_tester_fk';

    SELECT array_agg(a.attname::text ORDER BY k.ord)
      INTO v_target_columns
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a
      ON a.attrelid = c.confrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.assignments'::regclass
      AND c.conname = 'assignments_cohort_tester_fk';

    IF v_constraint_type <> 'f'
       OR v_target_table <> 'public.cohort_tests'::regclass
       OR v_source_columns IS DISTINCT FROM ARRAY['cohort_id','tester_id']::text[]
       OR v_target_columns IS DISTINCT FROM ARRAY['cohort_id','developer_id']::text[] THEN
      RAISE EXCEPTION 'Refusing to drop assignments_cohort_tester_fk: unexpected definition (source %, target table %, target columns %)',
        v_source_columns, v_target_table::regclass, v_target_columns;
    END IF;

    ALTER TABLE public.assignments
      DROP CONSTRAINT assignments_cohort_tester_fk;
  END IF;

  -- Ensure the correct assignment -> cohort/test relationship exists.
  SELECT c.contype, c.confrelid, c.convalidated
    INTO v_constraint_type, v_target_table, v_validated
  FROM pg_constraint c
  WHERE c.conrelid = 'public.assignments'::regclass
    AND c.conname = 'assignments_cohort_test_fk';

  IF FOUND THEN
    SELECT array_agg(a.attname::text ORDER BY k.ord)
      INTO v_source_columns
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.assignments'::regclass
      AND c.conname = 'assignments_cohort_test_fk';

    SELECT array_agg(a.attname::text ORDER BY k.ord)
      INTO v_target_columns
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a
      ON a.attrelid = c.confrelid AND a.attnum = k.attnum
    WHERE c.conrelid = 'public.assignments'::regclass
      AND c.conname = 'assignments_cohort_test_fk';

    IF v_constraint_type <> 'f'
       OR v_target_table <> 'public.cohort_tests'::regclass
       OR v_source_columns IS DISTINCT FROM ARRAY['cohort_id','test_id']::text[]
       OR v_target_columns IS DISTINCT FROM ARRAY['cohort_id','test_id']::text[] THEN
      RAISE EXCEPTION 'Refusing to modify assignments_cohort_test_fk: unexpected definition (source %, target table %, target columns %)',
        v_source_columns, v_target_table::regclass, v_target_columns;
    END IF;

    IF NOT v_validated THEN
      ALTER TABLE public.assignments
        VALIDATE CONSTRAINT assignments_cohort_test_fk;
    END IF;
  ELSE
    SELECT count(*) INTO v_orphans
    FROM public.assignments a
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.cohort_tests ct
      WHERE ct.cohort_id = a.cohort_id
        AND ct.test_id = a.test_id
    );

    IF v_orphans > 0 THEN
      RAISE EXCEPTION 'Cannot add assignments_cohort_test_fk: % assignment row(s) do not match cohort_tests', v_orphans;
    END IF;

    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_cohort_test_fk
      FOREIGN KEY (cohort_id, test_id)
      REFERENCES public.cohort_tests (cohort_id, test_id)
      ON DELETE RESTRICT;
  END IF;
END
$reconcile$;

-- Post-flight: fail if the invalid FK remains or the correct FK is missing.
DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.assignments'::regclass
      AND c.conname = 'assignments_cohort_tester_fk'
  ) THEN
    RAISE EXCEPTION 'Invalid assignments_cohort_tester_fk remains';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.assignments'::regclass
      AND c.conname = 'assignments_cohort_test_fk'
      AND c.contype = 'f'
      AND c.convalidated
  ) THEN
    RAISE EXCEPTION 'Correct validated assignments_cohort_test_fk is missing';
  END IF;
END
$verify$;

COMMIT;
