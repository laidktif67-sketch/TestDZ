-- Keep cohort participant visibility semantics unchanged while avoiding per-row
-- auth.uid()/admin predicate evaluation, and index uncovered foreign keys.

CREATE INDEX IF NOT EXISTS assignments_cohort_tester_fk_idx
  ON public.assignments (cohort_id, tester_id);

CREATE INDEX IF NOT EXISTS cohort_tests_developer_id_fk_idx
  ON public.cohort_tests (developer_id);

CREATE INDEX IF NOT EXISTS cohort_tests_test_developer_fk_idx
  ON public.cohort_tests (test_id, developer_id);

-- Medical extension requests are first-class records; assignments retain only the
-- final approved extension snapshot. Keep review actions admin-only via RLS.
CREATE TABLE IF NOT EXISTS public.medical_exception_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE RESTRICT,
  tester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  requested_days integer NOT NULL CHECK (requested_days BETWEEN 1 AND 30),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medical_exception_review_consistency CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS medical_exception_requests_assignment_status_idx
  ON public.medical_exception_requests (assignment_id, status);

ALTER TABLE public.medical_exception_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.medical_exception_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.medical_exception_requests TO authenticated;

DROP POLICY IF EXISTS medical_exception_requests_select_owner_or_admin
  ON public.medical_exception_requests;
CREATE POLICY medical_exception_requests_select_owner_or_admin
ON public.medical_exception_requests
FOR SELECT TO authenticated
USING (tester_id = (SELECT auth.uid()) OR (SELECT private.is_admin()));

DROP POLICY IF EXISTS medical_exception_requests_insert_owner
  ON public.medical_exception_requests;
CREATE POLICY medical_exception_requests_insert_owner
ON public.medical_exception_requests
FOR INSERT TO authenticated
WITH CHECK (
  tester_id = (SELECT auth.uid())
  AND status = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_id AND a.tester_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS medical_exception_requests_update_admin
  ON public.medical_exception_requests;
CREATE POLICY medical_exception_requests_update_admin
ON public.medical_exception_requests
FOR UPDATE TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

CREATE INDEX IF NOT EXISTS medical_exception_requests_reviewed_by_fk_idx
  ON public.medical_exception_requests (reviewed_by);

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
