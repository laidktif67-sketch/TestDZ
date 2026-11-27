-- Assignment review lifecycle foundation (V2 candidate only).
-- This migration deliberately fails closed at finalization until the 14-day,
-- feedback-quality, and V2 medical-exception gates are implemented and tested.
BEGIN;

-- Preserve the existing single report as attempt 1, then permit immutable
-- historical attempts plus at most one editable/awaiting-review attempt.
ALTER TABLE rebuild_v2.assignment_submissions
  ADD COLUMN attempt_number integer NOT NULL DEFAULT 1,
  ADD COLUMN reviewed_by uuid REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN review_note text,
  ADD COLUMN review_due_at timestamptz,
  ADD COLUMN reminder_sent_at timestamptz,
  ADD COLUMN auto_approved_at timestamptz;

ALTER TABLE rebuild_v2.assignment_submissions
  DROP CONSTRAINT IF EXISTS assignment_submissions_assignment_id_key,
  DROP CONSTRAINT IF EXISTS assignment_submissions_status_check,
  ADD CONSTRAINT assignment_submissions_attempt_number_check
    CHECK (attempt_number > 0),
  ADD CONSTRAINT assignment_submissions_review_note_check
    CHECK (review_note IS NULL OR char_length(review_note) <= 2000),
  ADD CONSTRAINT assignment_submissions_review_metadata_check
    CHECK (
      (reviewed_by IS NULL AND reviewed_at IS NULL)
      OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
  ADD CONSTRAINT assignment_submissions_status_check
    CHECK (
      status IN ('draft','submitted','changes_requested','approved','auto_approved')
      AND ((status = 'draft' AND submitted_at IS NULL)
        OR (status <> 'draft' AND submitted_at IS NOT NULL))
    ),
  ADD CONSTRAINT assignment_submissions_attempt_unique
    UNIQUE (assignment_id, attempt_number);

CREATE UNIQUE INDEX assignment_submissions_one_open_attempt_uidx
  ON rebuild_v2.assignment_submissions(assignment_id)
  WHERE status IN ('draft','submitted');

CREATE INDEX assignment_submissions_review_due_idx
  ON rebuild_v2.assignment_submissions(review_due_at, id)
  WHERE status = 'submitted' AND review_due_at IS NOT NULL;

CREATE TABLE rebuild_v2.assignment_submission_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL
    REFERENCES rebuild_v2.assignment_submissions(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL
    REFERENCES rebuild_v2.assignments(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL
    REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('approved','changes_requested')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_submission_reviews_one_decision
    UNIQUE (submission_id),
  CONSTRAINT assignment_submission_reviews_reason_check
    CHECK (
      (decision = 'approved' AND (reason IS NULL OR char_length(reason) <= 2000))
      OR (decision = 'changes_requested' AND char_length(btrim(reason)) BETWEEN 10 AND 2000)
    )
);

CREATE INDEX assignment_submission_reviews_assignment_idx
  ON rebuild_v2.assignment_submission_reviews(assignment_id, created_at DESC);

ALTER TABLE rebuild_v2.assignment_submission_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.assignment_submission_reviews FORCE ROW LEVEL SECURITY;
-- No client policy or grants: trusted SECURITY DEFINER RPCs are its only writer.
REVOKE ALL ON TABLE rebuild_v2.assignment_submission_reviews
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER assignment_submission_reviews_immutable_v2
  BEFORE UPDATE OR DELETE ON rebuild_v2.assignment_submission_reviews
  FOR EACH ROW EXECUTE FUNCTION rebuild_v2_private.prevent_immutable_mutation();

-- A requested revision closes the previous attempt; the next call creates a
-- fresh draft and never overwrites the submitted report or its evidence.
CREATE OR REPLACE FUNCTION rebuild_v2_private.create_assignment_submission_impl(
  p_assignment_id uuid,
  p_summary text,
  p_comments text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_existing rebuild_v2.assignment_submissions%ROWTYPE;
  v_submission_id uuid;
  v_attempt_number integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF p_assignment_id IS NULL OR p_summary IS NULL
     OR char_length(btrim(p_summary)) NOT BETWEEN 20 AND 2000
     OR (p_comments IS NOT NULL AND char_length(p_comments) > 500) THEN
    RAISE EXCEPTION 'SUBMISSION_INPUT_INVALID' USING errcode = '22023';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id = p_assignment_id
  FOR UPDATE;
  IF NOT FOUND OR v_assignment.tester_id <> v_user_id THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING errcode = '42501';
  END IF;
  IF v_assignment.status <> 'active' THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_ACTIVE' USING errcode = '55000';
  END IF;

  SELECT * INTO v_existing
  FROM rebuild_v2.assignment_submissions s
  WHERE s.assignment_id = p_assignment_id
  ORDER BY s.attempt_number DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'draft' THEN
      UPDATE rebuild_v2.assignment_submissions
      SET summary = btrim(p_summary),
          comments = NULLIF(btrim(p_comments), ''),
          updated_at = now()
      WHERE id = v_existing.id;
      RETURN v_existing.id;
    END IF;
    IF v_existing.status <> 'changes_requested' THEN
      RAISE EXCEPTION 'SUBMISSION_NOT_EDITABLE' USING errcode = '55000';
    END IF;
    v_attempt_number := v_existing.attempt_number + 1;
  ELSE
    v_attempt_number := 1;
  END IF;

  INSERT INTO rebuild_v2.assignment_submissions(
    assignment_id, test_id, tester_id, summary, comments, attempt_number
  )
  VALUES (
    p_assignment_id, v_assignment.test_id, v_user_id,
    btrim(p_summary), NULLIF(btrim(p_comments), ''), v_attempt_number
  )
  RETURNING id INTO v_submission_id;

  RETURN v_submission_id;
END;
$function$;

-- Only the developer who owns the test may decide. The assignment is locked
-- before the submission to serialize against tester resubmission and other
-- decisions. A submitted attempt can receive exactly one immutable decision.
CREATE OR REPLACE FUNCTION rebuild_v2_private.review_assignment_submission_impl(
  p_submission_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_submission rebuild_v2.assignment_submissions%ROWTYPE;
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_assignment_id uuid;
  v_developer_id uuid;
  v_test_title text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF p_submission_id IS NULL
     OR p_decision IS NULL
     OR p_decision NOT IN ('approved','changes_requested')
     OR (p_decision = 'changes_requested'
         AND char_length(btrim(COALESCE(p_reason,''))) NOT BETWEEN 10 AND 2000)
     OR (p_decision = 'approved' AND p_reason IS NOT NULL
         AND char_length(p_reason) > 2000) THEN
    RAISE EXCEPTION 'REVIEW_INPUT_INVALID' USING errcode = '22023';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_user_id, ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode = '42501';
  END IF;

  SELECT s.assignment_id INTO v_assignment_id
  FROM rebuild_v2.assignment_submissions s
  WHERE s.id = p_submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id = v_assignment_id
  FOR UPDATE;
  IF NOT FOUND OR v_assignment.status <> 'active' THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_REVIEWABLE' USING errcode = '55000';
  END IF;

  SELECT t.developer_id, t.title
  INTO v_developer_id, v_test_title
  FROM rebuild_v2.tests t
  WHERE t.id = v_assignment.test_id;
  IF v_developer_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'SUBMISSION_REVIEW_FORBIDDEN' USING errcode = '42501';
  END IF;

  SELECT * INTO v_submission
  FROM rebuild_v2.assignment_submissions s
  WHERE s.id = p_submission_id
    AND s.assignment_id = v_assignment.id
  FOR UPDATE;
  IF NOT FOUND OR v_submission.status <> 'submitted' THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_AWAITING_REVIEW' USING errcode = '55000';
  END IF;

  INSERT INTO rebuild_v2.assignment_submission_reviews(
    submission_id, assignment_id, actor_id, decision, reason
  )
  VALUES (
    v_submission.id, v_assignment.id, v_user_id, p_decision,
    NULLIF(btrim(p_reason), '')
  );

  UPDATE rebuild_v2.assignment_submissions
  SET status = p_decision,
      reviewed_by = v_user_id,
      reviewed_at = now(),
      review_note = NULLIF(btrim(p_reason), ''),
      updated_at = now()
  WHERE id = v_submission.id;

  IF p_decision = 'approved' THEN
    UPDATE rebuild_v2.assignments
    SET status = 'completed',
        completed_at = COALESCE(completed_at, now())
    WHERE id = v_assignment.id AND status = 'active';
  END IF;

  INSERT INTO rebuild_v2.audit_events(
    actor_id, action, target_type, target_id, reason, metadata
  )
  VALUES (
    v_user_id,
    'assignment_submission.' || p_decision,
    'assignment_submission',
    v_submission.id,
    NULLIF(btrim(p_reason), ''),
    jsonb_build_object(
      'assignment_id', v_assignment.id,
      'test_id', v_assignment.test_id,
      'attempt_number', v_submission.attempt_number
    )
  );

  PERFORM rebuild_v2_private.enqueue_notification_event(
    v_submission.tester_id,
    'tester',
    CASE WHEN p_decision = 'approved'
      THEN 'assignment.report_approved'
      ELSE 'assignment.report_changes_requested' END,
    CASE WHEN p_decision = 'approved'
      THEN 'Final report approved'
      ELSE 'Changes requested for your report' END,
    CASE WHEN p_decision = 'approved'
      THEN 'Your final report for ' || v_test_title || ' was approved.'
      ELSE 'The developer requested changes to your report for ' || v_test_title || '.'
    END,
    'assignment_submission',
    v_submission.id,
    jsonb_build_object(
      'assignment_id', v_assignment.id,
      'submission_id', v_submission.id,
      'decision', p_decision,
      'attempt_number', v_submission.attempt_number
    )
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.review_assignment_submission(
  p_submission_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.review_assignment_submission_impl(
    p_submission_id, p_decision, p_reason
  );
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.create_assignment_submission_impl(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.review_assignment_submission_impl(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2.review_assignment_submission(uuid,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2.review_assignment_submission(uuid,text,text)
  TO authenticated;

-- Critical fail-closed bridge: the previous implementation completed an
-- assignment immediately. Keep finalization unavailable until a subsequent
-- migration implements and tests the 14-day, feedback-quality, medical-date,
-- and evidence gates together. Never retain the unsafe 018 implementation.
CREATE OR REPLACE FUNCTION rebuild_v2_private.finalize_assignment_submission_impl(
  p_submission_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  RAISE EXCEPTION 'SUBMISSION_PREREQUISITES_NOT_IMPLEMENTED'
    USING errcode = '55000';
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.finalize_assignment_submission_impl(uuid)
  FROM PUBLIC, anon, authenticated;

COMMIT;
