-- Server-only 48h reminder / guarded 72h auto-approval processor.
-- No scheduler is installed by this migration; invocation remains an explicit
-- deployment/operations launch gate.
BEGIN;

-- System auto-approval has no human reviewer identity. Keep that distinct from
-- human review while requiring the timestamp pair and the auto-approval stamp.
ALTER TABLE rebuild_v2.assignment_submissions
  DROP CONSTRAINT IF EXISTS assignment_submissions_review_metadata_check,
  ADD CONSTRAINT assignment_submissions_review_metadata_check
  CHECK (
    (
      reviewed_by IS NULL
      AND reviewed_at IS NULL
      AND auto_approved_at IS NULL
    )
    OR (
      reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND auto_approved_at IS NULL
    )
    OR (
      status='auto_approved'
      AND reviewed_by IS NULL
      AND reviewed_at IS NOT NULL
      AND auto_approved_at IS NOT NULL
    )
  );

ALTER TABLE rebuild_v2.assignment_submission_reviews
  ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE rebuild_v2.assignment_submission_reviews
  DROP CONSTRAINT IF EXISTS assignment_submission_reviews_decision_check,
  DROP CONSTRAINT IF EXISTS assignment_submission_reviews_reason_check,
  ADD CONSTRAINT assignment_submission_reviews_decision_check
    CHECK (decision IN ('approved','changes_requested','auto_approved')),
  ADD CONSTRAINT assignment_submission_reviews_reason_check
    CHECK (
      (decision='approved' AND (reason IS NULL OR char_length(reason)<=2000))
      OR (decision IN ('changes_requested','auto_approved')
        AND char_length(btrim(reason)) BETWEEN 10 AND 2000)
    );

-- Once a report is submitted, medical dates cannot be added retroactively to
-- change the prerequisite set under developer review or the 72h deadline.
CREATE OR REPLACE FUNCTION rebuild_v2_private.guard_medical_request_after_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM rebuild_v2.assignment_submissions s
    WHERE s.assignment_id=NEW.assignment_id
      AND s.status IN ('submitted','approved','auto_approved')
  ) THEN
    RAISE EXCEPTION 'MEDICAL_REQUEST_CLOSED_AFTER_SUBMISSION' USING errcode='55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER medical_exception_no_post_submission_request_v2
  BEFORE INSERT ON rebuild_v2.medical_exception_requests
  FOR EACH ROW
  EXECUTE FUNCTION rebuild_v2_private.guard_medical_request_after_submission();

CREATE OR REPLACE FUNCTION rebuild_v2.process_assignment_review_deadlines(
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_candidate record;
  v_submission rebuild_v2.assignment_submissions%ROWTYPE;
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_developer_id uuid;
  v_test_title text;
  v_reminders integer := 0;
  v_auto_approved integer := 0;
  v_blocked integer := 0;
  v_reason text := 'Automatically approved 72 hours after submission: the developer did not request changes, and all server-side completion prerequisites were revalidated.';
BEGIN
  IF COALESCE(auth.jwt()->>'role','')<>'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'BATCH_SIZE_INVALID' USING errcode='22023';
  END IF;

  -- Lock assignment rows first, matching the tester finalization and developer
  -- review lock order. SKIP LOCKED avoids racing a live developer decision.
  FOR v_candidate IN
    SELECT a.id AS assignment_id,s.id AS submission_id
    FROM rebuild_v2.assignments a
    JOIN rebuild_v2.assignment_submissions s ON s.assignment_id=a.id
    WHERE s.status='submitted'
      AND (
        (s.reminder_sent_at IS NULL AND s.submitted_at<=now()-interval '48 hours')
        OR s.review_due_at<=now()
      )
    ORDER BY COALESCE(s.review_due_at,s.submitted_at),s.id
    LIMIT p_limit
    FOR UPDATE OF a SKIP LOCKED
  LOOP
    SELECT * INTO v_assignment
    FROM rebuild_v2.assignments a
    WHERE a.id=v_candidate.assignment_id;

    SELECT * INTO v_submission
    FROM rebuild_v2.assignment_submissions s
    WHERE s.id=v_candidate.submission_id
    FOR UPDATE;
    IF NOT FOUND OR v_submission.status<>'submitted' THEN
      CONTINUE;
    END IF;

    SELECT t.developer_id,t.title INTO v_developer_id,v_test_title
    FROM rebuild_v2.tests t WHERE t.id=v_assignment.test_id;

    IF v_submission.reminder_sent_at IS NULL
       AND v_submission.submitted_at<=now()-interval '48 hours' THEN
      PERFORM rebuild_v2_private.enqueue_notification_event(
        v_developer_id,'developer','assignment.review_reminder',
        'Tester report awaiting review',
        'A tester report for '||COALESCE(v_test_title,'your test')||' has been waiting for 48 hours. Review it before the 72-hour deadline.',
        'assignment_submission',v_submission.id,
        jsonb_build_object(
          'assignment_id',v_assignment.id,
          'submission_id',v_submission.id,
          'review_due_at',v_submission.review_due_at
        )
      );
      UPDATE rebuild_v2.assignment_submissions
      SET reminder_sent_at=now(),updated_at=now()
      WHERE id=v_submission.id AND reminder_sent_at IS NULL;
      v_reminders:=v_reminders+1;
      v_submission.reminder_sent_at:=now();
    END IF;

    IF v_submission.review_due_at IS NOT NULL
       AND v_submission.review_due_at<=now() THEN
      -- A reminder must have been delivered at least 24h ago. If the worker
      -- was unavailable at 48h, this delays auto-approval rather than silently
      -- removing the developer's review opportunity.
      IF v_submission.reminder_sent_at IS NULL
         OR v_submission.reminder_sent_at>now()-interval '24 hours' THEN
        CONTINUE;
      END IF;

      IF NOT rebuild_v2_private.assignment_submission_prerequisites_met(v_submission.id) THEN
        v_blocked:=v_blocked+1;
        CONTINUE;
      END IF;

      UPDATE rebuild_v2.assignment_submissions
      SET status='auto_approved',
          auto_approved_at=now(),
          reviewed_at=now(),
          reviewed_by=NULL,
          review_note=v_reason,
          updated_at=now()
      WHERE id=v_submission.id AND status='submitted';

      UPDATE rebuild_v2.assignments
      SET status='completed',completed_at=COALESCE(completed_at,now())
      WHERE id=v_assignment.id AND status='active';

      INSERT INTO rebuild_v2.assignment_submission_reviews(
        submission_id,assignment_id,actor_id,decision,reason
      )
      VALUES(
        v_submission.id,v_assignment.id,NULL,'auto_approved',v_reason
      );

      INSERT INTO rebuild_v2.audit_events(
        actor_id,action,target_type,target_id,reason,metadata
      )
      VALUES(
        NULL,'assignment_submission.auto_approved',
        'assignment_submission',v_submission.id,v_reason,
        jsonb_build_object(
          'assignment_id',v_assignment.id,
          'test_id',v_assignment.test_id,
          'attempt_number',v_submission.attempt_number,
          'submitted_at',v_submission.submitted_at,
          'reminder_sent_at',v_submission.reminder_sent_at,
          'review_due_at',v_submission.review_due_at,
          'prerequisites_revalidated',true
        )
      );

      PERFORM rebuild_v2_private.enqueue_notification_event(
        v_submission.tester_id,'tester','assignment.report_auto_approved',
        'Final report automatically approved',
        'Your report for '||COALESCE(v_test_title,'the assignment')||' was approved after the review period. No reward or payment was issued by this decision.',
        'assignment_submission',v_submission.id,
        jsonb_build_object(
          'assignment_id',v_assignment.id,
          'submission_id',v_submission.id,
          'decision','auto_approved',
          'attempt_number',v_submission.attempt_number
        )
      );
      v_auto_approved:=v_auto_approved+1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'reminders_sent',v_reminders,
    'auto_approved',v_auto_approved,
    'blocked_by_prerequisites',v_blocked
  );
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.guard_medical_request_after_submission()
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rebuild_v2.process_assignment_review_deadlines(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.process_assignment_review_deadlines(integer)
  TO service_role;

COMMENT ON FUNCTION rebuild_v2.process_assignment_review_deadlines(integer) IS
  'Service-role-only processor: one 48h developer reminder and guarded 72h auto-approval after a 24h reminder opportunity, rechecking all completion prerequisites. No reward or payment side effects.';

COMMIT;
