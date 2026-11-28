-- Strict pending medical-exception policy with safe post-failure adjudication.
-- Candidate V2 migration only. Never apply to hosted Supabase without separate approval.
BEGIN;

-- A pending request is not an excuse. It must not pause the check-in sequence.
-- Testers may still submit evidence for a pending request after an interruption.
CREATE OR REPLACE FUNCTION rebuild_v2_private.can_upload_medical_exception_evidence(
  p_object_name text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_assignment_id uuid;
  v_tester_id uuid;
  v_request_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL
     OR p_object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|pdf)$' THEN
    RETURN false;
  END IF;
  v_assignment_id := split_part(p_object_name,'/',1)::uuid;
  v_tester_id := split_part(p_object_name,'/',2)::uuid;
  v_request_id := split_part(p_object_name,'/',3)::uuid;
  RETURN v_tester_id=(SELECT auth.uid()) AND EXISTS (
    SELECT 1
    FROM rebuild_v2.medical_exception_requests r
    JOIN rebuild_v2.assignments a ON a.id=r.assignment_id
    WHERE r.id=v_request_id
      AND r.assignment_id=v_assignment_id
      AND r.tester_id=v_tester_id
      AND r.status='pending'
      AND r.evidence_storage_path IS NULL
      AND a.tester_id=v_tester_id
      AND a.status IN ('active','failed')
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.create_medical_exception_request_impl(
  p_assignment_id uuid,
  p_reason text,
  p_requested_dates date[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_today date := rebuild_v2_private.algeria_local_date();
  v_distinct_dates integer;
  v_fourteenth_required_date date;
  v_request_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_actor,ARRAY['tester']) THEN
    RAISE EXCEPTION 'TESTER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_assignment_id IS NULL
     OR p_reason IS NULL
     OR char_length(btrim(p_reason)) NOT BETWEEN 20 AND 4000
     OR p_requested_dates IS NULL
     OR cardinality(p_requested_dates) NOT BETWEEN 1 AND 14
     OR array_position(p_requested_dates,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_INPUT_INVALID' USING errcode='22023';
  END IF;

  SELECT count(DISTINCT d)::integer INTO v_distinct_dates
  FROM unnest(p_requested_dates) AS dates(d);
  IF v_distinct_dates <> cardinality(p_requested_dates) THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_DUPLICATE_DATES' USING errcode='22023';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id=p_assignment_id
  FOR UPDATE;
  IF NOT FOUND OR v_assignment.tester_id<>v_actor THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING errcode='42501';
  END IF;
  IF v_assignment.status NOT IN ('active','failed') OR v_assignment.started_at IS NULL THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_ELIGIBLE_FOR_MEDICAL_REQUEST' USING errcode='55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_requested_dates) d
    WHERE d < rebuild_v2_private.algeria_local_date(v_assignment.started_at)
       OR d > v_today
  ) THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_DATE_OUTSIDE_ELAPSED_ASSIGNMENT' USING errcode='22023';
  END IF;

  -- A request may only excuse dates inside the current 14-required-day
  -- window. Previously approved dates shift that window; pending dates do not.
  SELECT g.day::date INTO v_fourteenth_required_date
  FROM generate_series(
    rebuild_v2_private.algeria_local_date(v_assignment.started_at)::timestamp,
    v_today::timestamp,
    interval '1 day'
  ) g(day)
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

  IF v_fourteenth_required_date IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM unnest(p_requested_dates) d
       WHERE d > v_fourteenth_required_date
     ) THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_DATE_OUTSIDE_REQUIRED_SCHEDULE' USING errcode='22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_requested_dates) d
    JOIN rebuild_v2.checkins c
      ON c.assignment_id=p_assignment_id AND c.checkin_date=d
  ) THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_DATE_HAS_CHECKIN' USING errcode='23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM rebuild_v2.medical_exception_requests r
    WHERE r.assignment_id=p_assignment_id
      AND r.status IN ('pending','approved')
      AND r.requested_dates && p_requested_dates
  ) THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_DATE_ALREADY_REQUESTED' USING errcode='23505';
  END IF;

  INSERT INTO rebuild_v2.medical_exception_requests(
    assignment_id,tester_id,reason,requested_dates
  )
  VALUES(p_assignment_id,v_actor,btrim(p_reason),p_requested_dates)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$function$;

-- Replace the check-in evaluator so only Admin-approved dates are skipped.
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
  v_required_days_elapsed integer;
  v_fourteenth_required_date date;
  v_missed_through date;
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

  SELECT count(*)::integer INTO v_required_days_elapsed
  FROM generate_series(v_start_date::timestamp,v_checkin_date::timestamp,interval '1 day') g(day)
  WHERE NOT EXISTS (
    SELECT 1
    FROM rebuild_v2.medical_exception_requests r
    CROSS JOIN LATERAL unnest(r.requested_dates) AS x(excused_date)
    WHERE r.assignment_id=p_assignment_id
      AND r.status='approved'
      AND x.excused_date=g.day::date
  );

  IF v_required_days_elapsed>=14 THEN
    SELECT g.day::date INTO v_fourteenth_required_date
    FROM generate_series(v_start_date::timestamp,v_checkin_date::timestamp,interval '1 day') g(day)
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
    v_missed_through := LEAST(v_checkin_date-1,v_fourteenth_required_date);
  ELSE
    v_missed_through := v_checkin_date-1;
  END IF;

  SELECT count(*)::integer INTO v_missed_days
  FROM generate_series(v_start_date::timestamp,v_missed_through::timestamp,interval '1 day') g(day)
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
      'A required Algeria-local calendar day passed without a check-in or Admin-approved medical exception.',
      jsonb_build_object(
        'missed_required_days',v_missed_days,
        'evaluated_through',v_missed_through,
        'start_date',v_start_date,
        'pending_medical_requests_do_not_pause_schedule',true
      )
    );

    SELECT t.title INTO v_test_title
    FROM rebuild_v2.tests t WHERE t.id=v_assignment.test_id;
    PERFORM rebuild_v2_private.enqueue_notification_event(
      v_user_id,'tester','assignment.interrupted',
      'Testing assignment interrupted',
      'A required daily check-in was missed for '||COALESCE(v_test_title,'your assignment')||'. A pending medical request does not pause the schedule; an Admin-approved exception is required.',
      'assignment',p_assignment_id,
      jsonb_build_object(
        'assignment_id',p_assignment_id,
        'missed_required_days',v_missed_days,
        'pending_medical_requests_do_not_pause_schedule',true
      )
    );
    RETURN NULL;
  END IF;

  SELECT c.id INTO v_checkin_id
  FROM rebuild_v2.checkins c
  WHERE c.assignment_id=p_assignment_id AND c.checkin_date=v_checkin_date;
  IF v_checkin_id IS NOT NULL THEN
    RETURN v_checkin_id;
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

-- Admin may adjudicate a pending request after the assignment has failed.
-- Approval revives it only when every elapsed required date is checked in or
-- explicitly excused by an approved request. Other missed dates keep it failed.
CREATE OR REPLACE FUNCTION rebuild_v2_private.review_medical_exception_impl(
  p_request_id uuid,
  p_decision text,
  p_review_note text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_request rebuild_v2.medical_exception_requests%ROWTYPE;
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_days integer;
  v_old_due_at timestamptz;
  v_new_due_at timestamptz;
  v_old_extension_days integer;
  v_new_extension_days integer;
  v_old_assignment_status text;
  v_new_assignment_status text;
  v_test_title text;
  v_today date := rebuild_v2_private.algeria_local_date();
  v_start_date date;
  v_fourteenth_required_date date;
  v_recovery_through date;
  v_unexcused_missed_days integer := 0;
  v_reactivated boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_actor,ARRAY['admin']) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING errcode='42501';
  END IF;
  IF p_request_id IS NULL
     OR p_decision IS NULL
     OR p_decision NOT IN ('approved','rejected')
     OR p_review_note IS NULL
     OR char_length(btrim(p_review_note)) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_REVIEW_INPUT_INVALID' USING errcode='22023';
  END IF;

  SELECT assignment_id INTO v_request.assignment_id
  FROM rebuild_v2.medical_exception_requests
  WHERE id=p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_REQUEST_NOT_FOUND' USING errcode='P0002';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id=v_request.assignment_id
  FOR UPDATE;
  IF NOT FOUND OR v_assignment.status NOT IN ('active','failed') THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_ASSIGNMENT_NOT_REVIEWABLE' USING errcode='55000';
  END IF;

  SELECT * INTO v_request
  FROM rebuild_v2.medical_exception_requests r
  WHERE r.id=p_request_id AND r.assignment_id=v_assignment.id
  FOR UPDATE;
  IF NOT FOUND OR v_request.status<>'pending' THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_REQUEST_NOT_PENDING' USING errcode='55000';
  END IF;
  IF v_request.tester_id=v_actor THEN
    RAISE EXCEPTION 'SELF_REVIEW_NOT_ALLOWED' USING errcode='42501';
  END IF;

  IF p_decision='approved' THEN
    IF EXISTS (
      SELECT 1
      FROM unnest(v_request.requested_dates) d
      JOIN rebuild_v2.checkins c
        ON c.assignment_id=v_assignment.id AND c.checkin_date=d
    ) OR EXISTS (
      SELECT 1
      FROM rebuild_v2.medical_exception_requests r
      WHERE r.assignment_id=v_assignment.id
        AND r.id<>v_request.id
        AND r.status='approved'
        AND r.requested_dates && v_request.requested_dates
    ) THEN
      RAISE EXCEPTION 'MEDICAL_EXCEPTION_DATES_OVERLAP' USING errcode='23514';
    END IF;

    IF v_request.evidence_storage_path IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id='medical-exception-evidence'
        AND o.name=v_request.evidence_storage_path
        AND o.owner_id=v_request.tester_id::text
        AND (o.metadata->>'size') ~ '^[0-9]+$'
        AND (o.metadata->>'size')::bigint BETWEEN 1 AND 5242880
        AND o.metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp','application/pdf')
    ) THEN
      RAISE EXCEPTION 'MEDICAL_EXCEPTION_EVIDENCE_NOT_VERIFIED' USING errcode='55000';
    END IF;
  END IF;

  v_days := CASE WHEN p_decision='approved' THEN cardinality(v_request.requested_dates) ELSE 0 END;
  v_old_due_at := v_assignment.due_at;
  v_old_extension_days := v_assignment.medical_extension_days;
  v_old_assignment_status := v_assignment.status;
  v_new_due_at := CASE WHEN v_days>0
    THEN COALESCE(v_assignment.due_at,v_assignment.started_at)+make_interval(days=>v_days)
    ELSE v_assignment.due_at END;
  v_new_extension_days := v_old_extension_days+v_days;

  UPDATE rebuild_v2.medical_exception_requests
  SET status=p_decision,
      reviewed_by=v_actor,
      reviewed_at=now(),
      review_note=btrim(p_review_note)
  WHERE id=v_request.id;

  IF p_decision='approved' THEN
    UPDATE rebuild_v2.assignments
    SET due_at=v_new_due_at,
        medical_extension_days=v_new_extension_days,
        medical_exception_approved_at=now(),
        medical_exception_approved_by=v_actor,
        medical_exception_note=concat_ws(E'\n',NULLIF(medical_exception_note,''),btrim(p_review_note))
    WHERE id=v_assignment.id;

    IF v_old_assignment_status='failed' THEN
      v_start_date := rebuild_v2_private.algeria_local_date(v_assignment.started_at);
      -- Only elapsed days before today can be considered missed. The current
      -- local date remains available for a check-in after a successful revival.
      SELECT g.day::date INTO v_fourteenth_required_date
      FROM generate_series(v_start_date::timestamp,(v_today-1)::timestamp,interval '1 day') g(day)
      WHERE NOT EXISTS (
        SELECT 1
        FROM rebuild_v2.medical_exception_requests r
        CROSS JOIN LATERAL unnest(r.requested_dates) x(excused_date)
        WHERE r.assignment_id=v_assignment.id
          AND r.status='approved'
          AND x.excused_date=g.day::date
      )
      ORDER BY g.day
      OFFSET 13 LIMIT 1;

      v_recovery_through := COALESCE(v_fourteenth_required_date,v_today-1);
      SELECT count(*)::integer INTO v_unexcused_missed_days
      FROM generate_series(v_start_date::timestamp,v_recovery_through::timestamp,interval '1 day') g(day)
      WHERE NOT EXISTS (
        SELECT 1
        FROM rebuild_v2.medical_exception_requests r
        CROSS JOIN LATERAL unnest(r.requested_dates) x(excused_date)
        WHERE r.assignment_id=v_assignment.id
          AND r.status='approved'
          AND x.excused_date=g.day::date
      )
      AND NOT EXISTS (
        SELECT 1 FROM rebuild_v2.checkins c
        WHERE c.assignment_id=v_assignment.id AND c.checkin_date=g.day::date
      );

      IF v_unexcused_missed_days=0 THEN
        UPDATE rebuild_v2.assignments
        SET status='active'
        WHERE id=v_assignment.id AND status='failed';
        v_reactivated := FOUND;
      END IF;
    END IF;
  ELSIF EXISTS (
    SELECT 1
    FROM unnest(v_request.requested_dates) AS dates(requested_date)
    WHERE requested_date<=v_today
      AND NOT EXISTS (
        SELECT 1 FROM rebuild_v2.checkins c
        WHERE c.assignment_id=v_assignment.id
          AND c.checkin_date=dates.requested_date
      )
      AND (
        SELECT count(*)
        FROM generate_series(
          rebuild_v2_private.algeria_local_date(v_assignment.started_at)::timestamp,
          dates.requested_date::timestamp,
          interval '1 day'
        ) g(day)
        WHERE NOT EXISTS (
          SELECT 1
          FROM rebuild_v2.medical_exception_requests approved_request
          CROSS JOIN LATERAL unnest(approved_request.requested_dates) approved_dates(excused_date)
          WHERE approved_request.assignment_id=v_assignment.id
            AND approved_request.status='approved'
            AND approved_dates.excused_date=g.day::date
        )
      )<=14
  ) AND v_assignment.status='active' THEN
    UPDATE rebuild_v2.assignments
    SET status='failed'
    WHERE id=v_assignment.id AND status='active';
    IF FOUND THEN
      INSERT INTO rebuild_v2.audit_events(
        actor_id,action,target_type,target_id,reason,metadata
      )
      VALUES(
        v_actor,'assignment.interrupted','assignment',v_assignment.id,
        'A medical exception was rejected and its requested required day remained without a check-in.',
        jsonb_build_object(
          'medical_exception_request_id',v_request.id,
          'requested_dates',v_request.requested_dates,
          'interruption_reason','medical_exception_rejected'
        )
      );
      PERFORM rebuild_v2_private.enqueue_notification_event(
        v_request.tester_id,'tester','assignment.interrupted',
        'Testing assignment interrupted',
        'The medical exception was rejected and the missed required day was not excused. The assignment is now marked as failed.',
        'assignment',v_assignment.id,
        jsonb_build_object(
          'assignment_id',v_assignment.id,
          'medical_exception_request_id',v_request.id,
          'reason','medical_exception_rejected'
        )
      );
    END IF;
  END IF;

  SELECT a.status INTO v_new_assignment_status
  FROM rebuild_v2.assignments a WHERE a.id=v_assignment.id;

  INSERT INTO rebuild_v2.audit_events(
    actor_id,action,target_type,target_id,reason,metadata
  )
  VALUES(
    v_actor,
    'medical_exception.'||p_decision,
    'medical_exception_request',
    v_request.id,
    btrim(p_review_note),
    jsonb_build_object(
      'assignment_id',v_assignment.id,
      'tester_id',v_request.tester_id,
      'requested_dates',v_request.requested_dates,
      'before',jsonb_build_object(
        'request_status',v_request.status,
        'assignment_status',v_old_assignment_status,
        'due_at',v_old_due_at,
        'medical_extension_days',v_old_extension_days
      ),
      'after',jsonb_build_object(
        'request_status',p_decision,
        'assignment_status',v_new_assignment_status,
        'due_at',v_new_due_at,
        'medical_extension_days',v_new_extension_days
      ),
      'reactivated_after_medical_approval',v_reactivated,
      'remaining_unexcused_missed_days',v_unexcused_missed_days
    )
  );

  IF v_reactivated THEN
    INSERT INTO rebuild_v2.audit_events(
      actor_id,action,target_type,target_id,reason,metadata
    )
    VALUES(
      v_actor,'assignment.reactivated_after_medical_approval',
      'assignment',v_assignment.id,
      'All elapsed required dates are now either checked in or explicitly Admin-approved.',
      jsonb_build_object(
        'medical_exception_request_id',v_request.id,
        'approved_dates',v_request.requested_dates,
        'recovery_through',v_recovery_through
      )
    );
  END IF;

  SELECT t.title INTO v_test_title
  FROM rebuild_v2.tests t WHERE t.id=v_assignment.test_id;

  PERFORM rebuild_v2_private.enqueue_notification_event(
    v_request.tester_id,
    'tester',
    'assignment.medical_exception_'||p_decision,
    CASE WHEN p_decision='approved' THEN 'Medical exception approved'
      ELSE 'Medical exception rejected' END,
    CASE WHEN p_decision='approved' THEN
      'Your approved medical exception extends the assignment schedule by '
        ||v_days||' day(s).'
        ||CASE WHEN v_reactivated
          THEN ' Your assignment has been reactivated; continue with today’s check-in.'
          WHEN v_old_assignment_status='failed'
          THEN ' The assignment remains failed because other required dates are still missing.'
          ELSE '' END
      ELSE 'Your medical exception request was rejected. The assignment schedule was not extended.'
        ||CASE WHEN v_new_assignment_status='failed'
          THEN ' The assignment remains failed.'
          ELSE '' END
      END,
    'medical_exception_request',
    v_request.id,
    jsonb_build_object(
      'assignment_id',v_assignment.id,
      'request_id',v_request.id,
      'decision',p_decision,
      'extension_days',v_days,
      'assignment_status',v_new_assignment_status,
      'reactivated',v_reactivated
    )
  );

  RETURN true;
END;
$function$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES (
  'medical-exception-evidence',
  'medical-exception-evidence',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name,
  public=false,
  file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

COMMENT ON FUNCTION rebuild_v2_private.create_medical_exception_request_impl(uuid,text,date[]) IS
  'Creates medical requests only for elapsed dates within the current 14-required-day schedule; previously approved dates shift the schedule, pending dates do not.';

COMMENT ON FUNCTION rebuild_v2_private.submit_checkin_impl(uuid,text) IS
  'Strict medical policy: pending requests never pause or extend the assignment; only Admin-approved dates are excluded from interruption checks.';
COMMENT ON FUNCTION rebuild_v2_private.review_medical_exception_impl(uuid,text,text) IS
  'Admin may review pending requests after assignment failure; approval extends only approved dates and reactivates only when no other elapsed required date is missing.';

COMMIT;
