-- Enforce the 14-valid-day assignment lifecycle and enable guarded final review.
-- V2 candidate only. Never apply to hosted Supabase without a separate approval.
BEGIN;

CREATE OR REPLACE FUNCTION rebuild_v2_private.assignment_has_14_valid_checkins(
  p_assignment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_start_date date;
  v_today date := rebuild_v2_private.algeria_local_date();
  v_required_days integer;
  v_fourteenth_required_date date;
  v_missing_days integer;
  v_valid_checkins integer;
BEGIN
  IF p_assignment_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id=p_assignment_id;
  IF NOT FOUND OR v_assignment.status<>'active' OR v_assignment.started_at IS NULL THEN
    RETURN false;
  END IF;

  v_start_date := rebuild_v2_private.algeria_local_date(v_assignment.started_at);
  IF v_today<v_start_date THEN RETURN false; END IF;

  SELECT count(*)::integer INTO v_required_days
  FROM generate_series(v_start_date::timestamp,v_today::timestamp,interval '1 day') g(day)
  WHERE NOT EXISTS (
    SELECT 1
    FROM rebuild_v2.medical_exception_requests r
    CROSS JOIN LATERAL unnest(r.requested_dates) AS x(excused_date)
    WHERE r.assignment_id=p_assignment_id
      AND r.status='approved'
      AND x.excused_date=g.day::date
  );
  IF v_required_days<14 THEN RETURN false; END IF;

  SELECT g.day::date INTO v_fourteenth_required_date
  FROM generate_series(v_start_date::timestamp,v_today::timestamp,interval '1 day') g(day)
  WHERE NOT EXISTS (
    SELECT 1
    FROM rebuild_v2.medical_exception_requests r
    CROSS JOIN LATERAL unnest(r.requested_dates) AS x(excused_date)
    WHERE r.assignment_id=p_assignment_id
      AND r.status='approved'
      AND x.excused_date=g.day::date
  )
  ORDER BY g.day
  OFFSET 13 LIMIT 1;

  SELECT count(*)::integer INTO v_missing_days
  FROM generate_series(v_start_date::timestamp,v_fourteenth_required_date::timestamp,interval '1 day') g(day)
  WHERE NOT EXISTS (
    SELECT 1
    FROM rebuild_v2.medical_exception_requests r
    CROSS JOIN LATERAL unnest(r.requested_dates) AS x(excused_date)
    WHERE r.assignment_id=p_assignment_id
      AND r.status='approved'
      AND x.excused_date=g.day::date
  )
  AND NOT EXISTS (
    SELECT 1 FROM rebuild_v2.checkins c
    WHERE c.assignment_id=p_assignment_id AND c.checkin_date=g.day::date
  );

  SELECT count(*)::integer INTO v_valid_checkins
  FROM rebuild_v2.checkins c
  WHERE c.assignment_id=p_assignment_id
    AND c.checkin_date BETWEEN v_start_date AND v_fourteenth_required_date
    AND NOT EXISTS (
      SELECT 1
      FROM rebuild_v2.medical_exception_requests r
      CROSS JOIN LATERAL unnest(r.requested_dates) AS x(excused_date)
      WHERE r.assignment_id=p_assignment_id
        AND r.status='approved'
        AND x.excused_date=c.checkin_date
    );

  IF EXISTS (
    SELECT 1
    FROM rebuild_v2.checkins c
    JOIN rebuild_v2.medical_exception_requests r
      ON r.assignment_id=c.assignment_id AND r.status='approved'
    CROSS JOIN LATERAL unnest(r.requested_dates) AS x(excused_date)
    WHERE c.assignment_id=p_assignment_id
      AND x.excused_date=c.checkin_date
  ) THEN
    RETURN false;
  END IF;

  RETURN v_missing_days=0 AND v_valid_checkins=14;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.assignment_submission_prerequisites_met(
  p_submission_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_submission rebuild_v2.assignment_submissions%ROWTYPE;
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_attachment_count integer;
  v_verified_attachment_count integer;
BEGIN
  IF p_submission_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_submission
  FROM rebuild_v2.assignment_submissions s
  WHERE s.id=p_submission_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id=v_submission.assignment_id;
  IF NOT FOUND OR v_assignment.status<>'active' THEN RETURN false; END IF;

  IF NOT rebuild_v2_private.assignment_has_14_valid_checkins(v_assignment.id) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.feedback f
    WHERE f.assignment_id=v_assignment.id
      AND f.tester_id=v_assignment.tester_id
      AND f.quality_status='accepted'
      AND f.reviewed_by IS NOT NULL
      AND f.reviewed_at IS NOT NULL
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM rebuild_v2.medical_exception_requests r
    WHERE r.assignment_id=v_assignment.id AND r.status='pending'
  ) THEN
    RETURN false;
  END IF;

  SELECT count(*)::integer INTO v_attachment_count
  FROM rebuild_v2.assignment_submission_attachments a
  WHERE a.submission_id=p_submission_id;

  SELECT count(*)::integer INTO v_verified_attachment_count
  FROM rebuild_v2.assignment_submission_attachments a
  JOIN storage.objects o
    ON o.bucket_id='test-evidence'
   AND o.name=a.storage_path
   AND o.owner_id=a.tester_id::text
   AND o.metadata->>'size'=a.size_bytes::text
   AND o.metadata->>'mimetype'=a.mime_type
  WHERE a.submission_id=p_submission_id;

  RETURN v_attachment_count=v_verified_attachment_count;
END;
$function$;

-- Enforce daily sequence in the server RPC. If a required prior day was missed,
-- fail the assignment in this transaction and return NULL (do not raise and
-- roll back the failure state). Approved medical dates are the only skipped days.
CREATE OR REPLACE FUNCTION rebuild_v2_private.submit_checkin_impl(
  p_assignment_id uuid,
  p_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_checkin_id uuid;
  v_checkin_date date := rebuild_v2_private.algeria_local_date();
  v_start_date date;
  v_missed_days integer;
  v_test_title text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  IF p_assignment_id IS NULL
     OR (p_note IS NOT NULL AND char_length(btrim(p_note)) NOT BETWEEN 1 AND 4000) THEN
    RAISE EXCEPTION 'CHECKIN_INPUT_INVALID' USING errcode='22023';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id=p_assignment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING errcode='P0002';
  END IF;
  IF v_assignment.tester_id<>v_user_id THEN
    RAISE EXCEPTION 'ASSIGNMENT_FORBIDDEN' USING errcode='42501';
  END IF;
  IF v_assignment.status<>'active' OR v_assignment.started_at IS NULL THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_ACTIVE' USING errcode='55000';
  END IF;

  v_start_date := rebuild_v2_private.algeria_local_date(v_assignment.started_at);
  IF v_checkin_date<v_start_date THEN
    RAISE EXCEPTION 'CHECKIN_BEFORE_ASSIGNMENT_START' USING errcode='22023';
  END IF;

  SELECT c.id INTO v_checkin_id
  FROM rebuild_v2.checkins c
  WHERE c.assignment_id=p_assignment_id AND c.checkin_date=v_checkin_date;
  IF v_checkin_id IS NOT NULL THEN
    RETURN v_checkin_id;
  END IF;

  SELECT count(*)::integer INTO v_missed_days
  FROM generate_series(v_start_date::timestamp,(v_checkin_date-1)::timestamp,interval '1 day') g(day)
  WHERE NOT EXISTS (
    SELECT 1
    FROM rebuild_v2.medical_exception_requests r
    CROSS JOIN LATERAL unnest(r.requested_dates) AS x(excused_date)
    WHERE r.assignment_id=p_assignment_id
      AND r.status='approved'
      AND x.excused_date=g.day::date
  )
  AND NOT EXISTS (
    SELECT 1 FROM rebuild_v2.checkins c
    WHERE c.assignment_id=p_assignment_id AND c.checkin_date=g.day::date
  );

  IF v_missed_days>0 THEN
    UPDATE rebuild_v2.assignments
    SET status='failed'
    WHERE id=p_assignment_id AND status='active';

    INSERT INTO rebuild_v2.audit_events(
      actor_id,action,target_type,target_id,reason,metadata
    )
    VALUES(
      v_user_id,'assignment.interrupted','assignment',p_assignment_id,
      'A required Algeria-local calendar day passed without a check-in or approved medical exception.',
      jsonb_build_object(
        'missed_required_days',v_missed_days,
        'evaluated_through',v_checkin_date-1,
        'start_date',v_start_date
      )
    );

    SELECT t.title INTO v_test_title
    FROM rebuild_v2.tests t WHERE t.id=v_assignment.test_id;
    PERFORM rebuild_v2_private.enqueue_notification_event(
      v_user_id,'tester','assignment.interrupted',
      'Testing assignment interrupted',
      'A required daily check-in was missed for '||COALESCE(v_test_title,'your assignment')||'. The assignment is now marked as failed.',
      'assignment',p_assignment_id,
      jsonb_build_object('assignment_id',p_assignment_id,'missed_required_days',v_missed_days)
    );
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rebuild_v2.medical_exception_requests r
    CROSS JOIN LATERAL unnest(r.requested_dates) AS x(excused_date)
    WHERE r.assignment_id=p_assignment_id
      AND r.status='approved'
      AND x.excused_date=v_checkin_date
  ) THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_DAY_EXCUSED' USING errcode='55000';
  END IF;

  IF (
    SELECT count(*) FROM rebuild_v2.checkins c
    WHERE c.assignment_id=p_assignment_id
  )>=14 THEN
    RAISE EXCEPTION 'ASSIGNMENT_CHECKINS_ALREADY_COMPLETE' USING errcode='55000';
  END IF;

  INSERT INTO rebuild_v2.checkins(assignment_id,tester_id,checkin_date,note)
  VALUES(p_assignment_id,v_user_id,v_checkin_date,NULLIF(btrim(p_note),''))
  RETURNING id INTO v_checkin_id;
  RETURN v_checkin_id;
EXCEPTION WHEN unique_violation THEN
  SELECT c.id INTO v_checkin_id
  FROM rebuild_v2.checkins c
  WHERE c.assignment_id=p_assignment_id AND c.checkin_date=v_checkin_date;
  IF v_checkin_id IS NOT NULL THEN RETURN v_checkin_id; END IF;
  RAISE;
END;
$function$;

-- Finalization and developer approval use the same server-side prerequisite
-- evaluator. The assignment stays active while the report awaits review.
CREATE OR REPLACE FUNCTION rebuild_v2_private.finalize_assignment_submission_impl(
  p_submission_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_assignment_id uuid;
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_submission rebuild_v2.assignment_submissions%ROWTYPE;
  v_developer_id uuid;
  v_test_title text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  IF p_submission_id IS NULL THEN
    RAISE EXCEPTION 'SUBMISSION_ID_REQUIRED' USING errcode='22023';
  END IF;

  SELECT s.assignment_id INTO v_assignment_id
  FROM rebuild_v2.assignment_submissions s
  WHERE s.id=p_submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND' USING errcode='P0002';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id=v_assignment_id
  FOR UPDATE;
  IF NOT FOUND OR v_assignment.tester_id<>v_user_id OR v_assignment.status<>'active' THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_ACTIVE' USING errcode='42501';
  END IF;

  SELECT * INTO v_submission
  FROM rebuild_v2.assignment_submissions s
  WHERE s.id=p_submission_id AND s.assignment_id=v_assignment.id
  FOR UPDATE;
  IF NOT FOUND OR v_submission.tester_id<>v_user_id THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND' USING errcode='42501';
  END IF;
  IF v_submission.status='submitted' THEN RETURN true; END IF;
  IF v_submission.status<>'draft' THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_EDITABLE' USING errcode='55000';
  END IF;
  IF NOT rebuild_v2_private.assignment_submission_prerequisites_met(p_submission_id) THEN
    RAISE EXCEPTION 'SUBMISSION_PREREQUISITES_NOT_MET' USING errcode='55000';
  END IF;

  UPDATE rebuild_v2.assignment_submissions
  SET status='submitted',
      submitted_at=now(),
      review_due_at=now()+interval '72 hours',
      updated_at=now()
  WHERE id=p_submission_id;

  SELECT t.developer_id,t.title INTO v_developer_id,v_test_title
  FROM rebuild_v2.tests t WHERE t.id=v_assignment.test_id;

  INSERT INTO rebuild_v2.audit_events(
    actor_id,action,target_type,target_id,reason,metadata
  )
  VALUES(
    v_user_id,'assignment_submission.submitted','assignment_submission',p_submission_id,
    'Tester finalized the report after all server-side completion prerequisites passed.',
    jsonb_build_object(
      'assignment_id',v_assignment.id,
      'test_id',v_assignment.test_id,
      'checkin_count',14,
      'feedback_quality_status','accepted',
      'review_due_at',now()+interval '72 hours'
    )
  );

  PERFORM rebuild_v2_private.enqueue_notification_event(
    v_developer_id,'developer','assignment.submitted',
    'Final report submitted',
    'A tester submitted the final report for '||v_test_title||'.',
    'assignment_submission',p_submission_id,
    jsonb_build_object(
      'test_id',v_assignment.test_id,
      'assignment_id',v_assignment.id,
      'submission_id',p_submission_id
    )
  );
  RETURN true;
END;
$function$;

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
  v_user_id uuid := auth.uid();
  v_assignment_id uuid;
  v_submission rebuild_v2.assignment_submissions%ROWTYPE;
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_developer_id uuid;
  v_test_title text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  IF p_submission_id IS NULL
     OR p_decision IS NULL
     OR p_decision NOT IN ('approved','changes_requested')
     OR (p_decision='changes_requested'
       AND char_length(btrim(COALESCE(p_reason,''))) NOT BETWEEN 10 AND 2000)
     OR (p_decision='approved' AND p_reason IS NOT NULL
       AND char_length(p_reason)>2000) THEN
    RAISE EXCEPTION 'REVIEW_INPUT_INVALID' USING errcode='22023';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_user_id,ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;

  SELECT s.assignment_id INTO v_assignment_id
  FROM rebuild_v2.assignment_submissions s
  WHERE s.id=p_submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND' USING errcode='P0002';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id=v_assignment_id
  FOR UPDATE;
  IF NOT FOUND OR v_assignment.status<>'active' THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_REVIEWABLE' USING errcode='55000';
  END IF;

  SELECT t.developer_id,t.title INTO v_developer_id,v_test_title
  FROM rebuild_v2.tests t WHERE t.id=v_assignment.test_id;
  IF v_developer_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'SUBMISSION_REVIEW_FORBIDDEN' USING errcode='42501';
  END IF;

  SELECT * INTO v_submission
  FROM rebuild_v2.assignment_submissions s
  WHERE s.id=p_submission_id AND s.assignment_id=v_assignment.id
  FOR UPDATE;
  IF NOT FOUND OR v_submission.status<>'submitted' THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_AWAITING_REVIEW' USING errcode='55000';
  END IF;

  IF p_decision='approved'
     AND NOT rebuild_v2_private.assignment_submission_prerequisites_met(p_submission_id) THEN
    RAISE EXCEPTION 'SUBMISSION_PREREQUISITES_NOT_MET' USING errcode='55000';
  END IF;

  INSERT INTO rebuild_v2.assignment_submission_reviews(
    submission_id,assignment_id,actor_id,decision,reason
  )
  VALUES(
    v_submission.id,v_assignment.id,v_user_id,p_decision,
    NULLIF(btrim(p_reason),'')
  );

  UPDATE rebuild_v2.assignment_submissions
  SET status=p_decision,
      reviewed_by=v_user_id,
      reviewed_at=now(),
      review_note=NULLIF(btrim(p_reason),''),
      updated_at=now()
  WHERE id=v_submission.id;

  IF p_decision='approved' THEN
    UPDATE rebuild_v2.assignments
    SET status='completed',completed_at=COALESCE(completed_at,now())
    WHERE id=v_assignment.id AND status='active';
  END IF;

  INSERT INTO rebuild_v2.audit_events(
    actor_id,action,target_type,target_id,reason,metadata
  )
  VALUES(
    v_user_id,'assignment_submission.'||p_decision,
    'assignment_submission',v_submission.id,NULLIF(btrim(p_reason),''),
    jsonb_build_object(
      'assignment_id',v_assignment.id,
      'test_id',v_assignment.test_id,
      'attempt_number',v_submission.attempt_number
    )
  );

  PERFORM rebuild_v2_private.enqueue_notification_event(
    v_submission.tester_id,'tester',
    CASE WHEN p_decision='approved'
      THEN 'assignment.report_approved'
      ELSE 'assignment.report_changes_requested' END,
    CASE WHEN p_decision='approved'
      THEN 'Final report approved'
      ELSE 'Changes requested for your report' END,
    CASE WHEN p_decision='approved'
      THEN 'Your final report for '||v_test_title||' was approved.'
      ELSE 'The developer requested changes to your report for '||v_test_title||'.' END,
    'assignment_submission',v_submission.id,
    jsonb_build_object(
      'assignment_id',v_assignment.id,
      'submission_id',v_submission.id,
      'decision',p_decision,
      'attempt_number',v_submission.attempt_number
    )
  );
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.assignment_has_14_valid_checkins(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.assignment_submission_prerequisites_met(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.submit_checkin_impl(uuid,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.finalize_assignment_submission_impl(uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.review_assignment_submission_impl(uuid,text,text)
  FROM PUBLIC,anon,authenticated;

COMMENT ON FUNCTION rebuild_v2_private.assignment_has_14_valid_checkins(uuid) IS
  'Checks exactly 14 valid required calendar dates, skipping only explicitly Admin-approved medical dates.';
COMMENT ON FUNCTION rebuild_v2_private.assignment_submission_prerequisites_met(uuid) IS
  'Shared fail-closed prerequisite evaluator for finalization and developer approval.';

COMMIT;
