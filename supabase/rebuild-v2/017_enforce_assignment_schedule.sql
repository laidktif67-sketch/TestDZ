-- Prevent testers from starting an assignment outside its scheduled test/cohort window.
-- Preserve idempotent retries for assignments that have already started.

CREATE OR REPLACE FUNCTION rebuild_v2_private.start_assignment_impl(p_assignment_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_test_status text;
  v_cohort_status text;
  v_cohort_starts_at timestamptz;
  v_cohort_ends_at timestamptz;
  v_test_start_date date;
  v_test_end_date date;
  v_business_date date := rebuild_v2_private.algeria_local_date();
  v_started_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING errcode = 'P0002';
  END IF;
  IF v_assignment.tester_id <> v_user_id THEN
    RAISE EXCEPTION 'ASSIGNMENT_FORBIDDEN' USING errcode = '42501';
  END IF;
  IF v_assignment.status NOT IN ('pending','active') THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_STARTABLE' USING errcode = '55000';
  END IF;

  SELECT t.status, c.status, c.starts_at, c.ends_at, t.start_date, t.end_date
  INTO v_test_status, v_cohort_status, v_cohort_starts_at, v_cohort_ends_at,
       v_test_start_date, v_test_end_date
  FROM rebuild_v2.tests t
  JOIN rebuild_v2.cohorts c ON c.id = v_assignment.cohort_id
  WHERE t.id = v_assignment.test_id;

  IF v_test_status NOT IN ('ready','running')
     OR v_cohort_status NOT IN ('ready','running') THEN
    RAISE EXCEPTION 'TEST_NOT_READY' USING errcode = '55000';
  END IF;

  -- A retry for an already-started assignment must return its original timestamp,
  -- even if the scheduled window has since elapsed.
  IF v_assignment.status = 'active' AND v_assignment.started_at IS NOT NULL THEN
    RETURN v_assignment.started_at;
  END IF;

  IF (v_cohort_starts_at IS NOT NULL AND v_cohort_starts_at > now())
     OR (v_cohort_ends_at IS NOT NULL AND v_cohort_ends_at <= now())
     OR (v_test_start_date IS NOT NULL AND v_test_start_date > v_business_date)
     OR (v_test_end_date IS NOT NULL AND v_test_end_date < v_business_date) THEN
    RAISE EXCEPTION 'ASSIGNMENT_OUTSIDE_TEST_WINDOW' USING errcode = '55000';
  END IF;

  UPDATE rebuild_v2.assignments
  SET status = 'active',
      started_at = COALESCE(started_at, now())
  WHERE id = p_assignment_id
  RETURNING started_at INTO v_started_at;

  RETURN v_started_at;
END;
$function$;
