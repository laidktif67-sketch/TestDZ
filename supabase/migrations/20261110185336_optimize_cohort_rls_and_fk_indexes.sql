-- Keep cohort participant visibility semantics unchanged while avoiding per-row
-- auth.uid()/admin predicate evaluation, and index uncovered foreign keys.

CREATE INDEX IF NOT EXISTS assignments_cohort_tester_fk_idx
  ON public.assignments (cohort_id, tester_id);

CREATE INDEX IF NOT EXISTS cohort_tests_developer_id_fk_idx
  ON public.cohort_tests (developer_id);

CREATE INDEX IF NOT EXISTS cohort_tests_test_developer_fk_idx
  ON public.cohort_tests (test_id, developer_id);

-- medical_exception_requests is not part of the current schema/migration set.
-- Add its FK index in the migration that introduces that table, if needed.

DROP POLICY IF EXISTS cohort_tests_select_participants ON public.cohort_tests;
CREATE POLICY cohort_tests_select_participants
ON public.cohort_tests
FOR SELECT
TO authenticated
USING (
  (SELECT private.is_admin())
  OR developer_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.cohort_id = cohort_tests.cohort_id
      AND a.tester_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS cohorts_select_participants ON public.cohorts;
CREATE POLICY cohorts_select_participants
ON public.cohorts
FOR SELECT
TO authenticated
USING (
  (SELECT private.is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.cohort_id = cohorts.id
      AND a.tester_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.cohort_tests ct
    WHERE ct.cohort_id = cohorts.id
      AND ct.developer_id = (SELECT auth.uid())
  )
);
