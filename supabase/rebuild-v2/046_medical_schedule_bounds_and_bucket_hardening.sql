-- Keep medical exception requests within the current 14-required-day schedule
-- and fail closed if the reserved private evidence bucket already exists unsafe.
-- Candidate V2 migration only. Never apply to hosted Supabase without approval.
BEGIN;

-- Do not silently strand pending requests created under the former wider date
-- range. Require an explicit manual decision before this migration can proceed.
DO $medical_request_schedule_preflight$
DECLARE
  v_invalid_count integer;
BEGIN
  WITH assignment_bounds AS (
    SELECT a.id,
      (
        SELECT g.day::date
        FROM generate_series(
          rebuild_v2_private.algeria_local_date(a.started_at)::timestamp,
          rebuild_v2_private.algeria_local_date()::timestamp,
          interval '1 day'
        ) g(day)
        WHERE NOT EXISTS (
          SELECT 1
          FROM rebuild_v2.medical_exception_requests approved
          CROSS JOIN LATERAL unnest(approved.requested_dates) AS x(excused_date)
          WHERE approved.assignment_id=a.id
            AND approved.status='approved'
            AND x.excused_date=g.day::date
        )
        ORDER BY g.day
        OFFSET 13 LIMIT 1
      ) AS fourteenth_required_date
    FROM rebuild_v2.assignments a
    WHERE a.started_at IS NOT NULL
  )
  SELECT count(*)::integer INTO v_invalid_count
  FROM rebuild_v2.medical_exception_requests r
  JOIN assignment_bounds b ON b.id=r.assignment_id
  WHERE r.status='pending'
    AND b.fourteenth_required_date IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM unnest(r.requested_dates) d
      WHERE d > b.fourteenth_required_date
    );

  IF v_invalid_count>0 THEN
    RAISE EXCEPTION
      'MEDICAL_REQUESTS_OUTSIDE_REQUIRED_SCHEDULE_REQUIRE_MANUAL_REVIEW: %',
      v_invalid_count;
  END IF;
END;
$medical_request_schedule_preflight$;

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

  -- Pending dates do not shift the schedule. Only dates already approved by
  -- Admin are excluded when finding the current 14th required date.
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

COMMIT;
