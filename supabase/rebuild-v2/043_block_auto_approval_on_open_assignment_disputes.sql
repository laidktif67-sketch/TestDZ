-- Prevent system auto-approval while an assignment-linked report or dispute is unresolved.
-- Candidate-only patch. Human developer review remains available through its normal RPC.
BEGIN;

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
  v_reminder_event_id uuid;
  v_reminder_status text;
  v_reminder_processed_at timestamptz;
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

  -- Assignment-first locking matches finalization and developer review.
  FOR v_candidate IN
    SELECT a.id AS assignment_id,s.id AS submission_id
    FROM rebuild_v2.assignments a
    JOIN rebuild_v2.assignment_submissions s ON s.assignment_id=a.id
    WHERE s.status='submitted'
      AND (
        (s.reminder_event_id IS NULL AND s.submitted_at<=now()-interval '48 hours')
        OR (s.reminder_event_id IS NOT NULL AND s.reminder_sent_at IS NULL)
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

    -- The timestamp is sourced only from the outbox's delivered state, never
    -- from enqueue time. Pending/failed reminders fail closed.
    IF v_submission.reminder_event_id IS NOT NULL
       AND v_submission.reminder_sent_at IS NULL THEN
      SELECT e.status,e.processed_at
      INTO v_reminder_status,v_reminder_processed_at
      FROM rebuild_v2.events e
      WHERE e.id=v_submission.reminder_event_id
        AND e.event_type='notification.requested'
        AND e.aggregate_type='assignment_submission'
        AND e.aggregate_id=v_submission.id
        AND e.payload->>'type'='assignment.review_reminder';

      IF v_reminder_status='failed'
         AND v_submission.reminder_delivery_retries<3 THEN
        -- A terminal outbox failure is retried with a new idempotent event.
        -- Keep the old failed event for audit; only move the active pointer.
        SELECT t.developer_id,t.title INTO v_developer_id,v_test_title
        FROM rebuild_v2.tests t WHERE t.id=v_assignment.test_id;
        v_reminder_event_id:=rebuild_v2_private.enqueue_notification_event(
          v_developer_id,'developer','assignment.review_reminder',
          'Tester report awaiting review',
          'A tester report for '||COALESCE(v_test_title,'your test')||' has been waiting for review. Please review it.',
          'assignment_submission',v_submission.id,
          jsonb_build_object(
            'assignment_id',v_assignment.id,
            'submission_id',v_submission.id,
            'review_due_at',v_submission.review_due_at,
            'delivery_retry',v_submission.reminder_delivery_retries+1
          )
        );
        UPDATE rebuild_v2.assignment_submissions
        SET reminder_event_id=v_reminder_event_id,
            reminder_delivery_retries=reminder_delivery_retries+1,
            reminder_sent_at=NULL,
            updated_at=now()
        WHERE id=v_submission.id;
        v_reminders:=v_reminders+1;
        CONTINUE;
      END IF;

      IF v_reminder_status IS DISTINCT FROM 'delivered'
         OR v_reminder_processed_at IS NULL THEN
        CONTINUE;
      END IF;

      UPDATE rebuild_v2.assignment_submissions
      SET reminder_sent_at=v_reminder_processed_at,updated_at=now()
      WHERE id=v_submission.id AND reminder_sent_at IS NULL;
      v_submission.reminder_sent_at:=v_reminder_processed_at;
    END IF;

    IF v_submission.reminder_event_id IS NULL
       AND v_submission.submitted_at<=now()-interval '48 hours' THEN
      v_reminder_event_id:=rebuild_v2_private.enqueue_notification_event(
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
      SET reminder_event_id=v_reminder_event_id,updated_at=now()
      WHERE id=v_submission.id AND reminder_event_id IS NULL;
      v_submission.reminder_event_id:=v_reminder_event_id;
      v_reminders:=v_reminders+1;
      -- Do not set reminder_sent_at here: this event has only been enqueued.
      CONTINUE;
    END IF;

    IF v_submission.review_due_at IS NOT NULL
       AND v_submission.review_due_at<=now() THEN
      -- A delivered in-app reminder must have been visible for at least 24h.
      IF v_submission.reminder_sent_at IS NULL
         OR v_submission.reminder_sent_at>now()-interval '24 hours' THEN
        CONTINUE;
      END IF;

      -- Assignment-linked reports and unresolved disputes block system approval.
      -- A human developer decision remains available through the normal review RPC.
      IF EXISTS (
        SELECT 1 FROM rebuild_v2.reports r
        WHERE r.assignment_id=v_assignment.id
          AND r.status IN ('open','under_review')
      ) OR EXISTS (
        SELECT 1
        FROM rebuild_v2.disputes d
        JOIN rebuild_v2.reports r ON r.id=d.report_id
        WHERE r.assignment_id=v_assignment.id
          AND d.status IN ('opened','under_review','escalated')
      ) THEN
        v_blocked:=v_blocked+1;
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
      VALUES(v_submission.id,v_assignment.id,NULL,'auto_approved',v_reason);

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
          'reminder_event_id',v_submission.reminder_event_id,
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
    'reminders_queued',v_reminders,
    'auto_approved',v_auto_approved,
    'blocked_by_prerequisites',v_blocked
  );
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2.process_assignment_review_deadlines(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.process_assignment_review_deadlines(integer)
  TO service_role;

COMMENT ON FUNCTION rebuild_v2.process_assignment_review_deadlines(integer) IS
  'Service-role-only processor: requires delivered reminder, revalidates completion prerequisites, and blocks automatic approval while an assignment-linked report or dispute remains unresolved. No reward/payment side effects.';

COMMIT;
