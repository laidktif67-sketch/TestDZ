-- A rejected request for today's date must not interrupt the assignment
-- before the Algeria-local day has elapsed. The tester may still check in today.
-- Candidate V2 migration only; never apply to hosted Supabase without approval.
BEGIN;

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
    WHERE requested_date<v_today
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


COMMENT ON FUNCTION rebuild_v2_private.review_medical_exception_impl(uuid,text,text) IS
  'Admin may review pending requests after assignment failure; approval extends only approved dates and reactivates only when no other elapsed required date is missing. Rejection interrupts only elapsed missed required dates; today remains available for check-in.';

COMMIT;
