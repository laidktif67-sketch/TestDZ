-- Medical exception and feedback-quality review workflows (V2 candidate only).
-- Apply only through the isolated rebuild-v2 replay; never against hosted Supabase
-- without a separately approved cutover.
BEGIN;

-- Private medical evidence is isolated from Support attachments and ordinary
-- report evidence. Objects are keyed by assignment/tester/request/file UUID.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES (
  'medical-exception-evidence',
  'medical-exception-evidence',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE UNIQUE INDEX medical_exception_requests_one_pending_per_assignment_uidx
  ON rebuild_v2.medical_exception_requests(assignment_id)
  WHERE status='pending';

CREATE INDEX medical_exception_requests_assignment_status_idx
  ON rebuild_v2.medical_exception_requests(assignment_id,status,created_at DESC);

-- Keep one review decision for each feedback row. The existing feedback row
-- stores the current state; immutable audit_events retain the decision history.
ALTER TABLE rebuild_v2.feedback
  ADD CONSTRAINT feedback_quality_review_metadata_check
  CHECK (
    (quality_status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR
    (quality_status IN ('accepted','rejected')
      AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  );

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
      AND a.status='active'
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_read_medical_exception_evidence(
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
  v_tester_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL THEN
    RETURN false;
  END IF;
  IF p_object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|pdf)$' THEN
    RETURN false;
  END IF;
  v_tester_id := split_part(p_object_name,'/',2)::uuid;
  RETURN EXISTS (
    SELECT 1
    FROM rebuild_v2.medical_exception_requests r
    WHERE r.evidence_storage_path=p_object_name
      AND r.tester_id=v_tester_id
      AND (r.tester_id=(SELECT auth.uid())
        OR rebuild_v2_private.has_role((SELECT auth.uid()),ARRAY['admin']))
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_medical_exception_evidence(text)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_medical_exception_evidence(text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_medical_exception_evidence(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_medical_exception_evidence(text)
  TO authenticated;

CREATE POLICY medical_exception_evidence_insert_v2 ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='medical-exception-evidence'
  AND rebuild_v2_private.can_upload_medical_exception_evidence(name)
);
CREATE POLICY medical_exception_evidence_select_v2 ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id='medical-exception-evidence'
  AND rebuild_v2_private.can_read_medical_exception_evidence(name)
);

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
  IF v_assignment.status<>'active' OR v_assignment.started_at IS NULL THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_ACTIVE' USING errcode='55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_requested_dates) d
    WHERE d < rebuild_v2_private.algeria_local_date(v_assignment.started_at)
       OR d > v_today
  ) THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_DATE_OUTSIDE_ELAPSED_ASSIGNMENT' USING errcode='22023';
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

CREATE OR REPLACE FUNCTION rebuild_v2_private.attach_medical_exception_evidence_impl(
  p_request_id uuid,
  p_storage_path text
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
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  IF p_request_id IS NULL OR p_storage_path IS NULL
     OR char_length(p_storage_path)>1024
     OR p_storage_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|pdf)$' THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_EVIDENCE_PATH_INVALID' USING errcode='22023';
  END IF;

  SELECT * INTO v_request
  FROM rebuild_v2.medical_exception_requests r
  WHERE r.id=p_request_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.tester_id<>v_actor THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_REQUEST_NOT_FOUND' USING errcode='42501';
  END IF;
  IF v_request.status<>'pending' OR v_request.evidence_storage_path IS NOT NULL THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_EVIDENCE_NOT_ATTACHABLE' USING errcode='55000';
  END IF;
  IF split_part(p_storage_path,'/',1)<>v_request.assignment_id::text
     OR split_part(p_storage_path,'/',2)<>v_actor::text
     OR split_part(p_storage_path,'/',3)<>v_request.id::text
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects o
       WHERE o.bucket_id='medical-exception-evidence'
         AND o.name=p_storage_path
         AND o.owner_id=v_actor::text
         AND (o.metadata->>'size') ~ '^[0-9]+$'
         AND (o.metadata->>'size')::bigint BETWEEN 1 AND 5242880
         AND o.metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp','application/pdf')
     ) THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_EVIDENCE_NOT_VERIFIED' USING errcode='55000';
  END IF;

  UPDATE rebuild_v2.medical_exception_requests
  SET evidence_storage_path=p_storage_path
  WHERE id=p_request_id AND evidence_storage_path IS NULL;
  RETURN true;
END;
$function$;

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
  v_test_title text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_actor,ARRAY['admin']) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING errcode='42501';
  END IF;
  IF p_request_id IS NULL
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
  IF NOT FOUND OR v_assignment.status<>'active' THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_ASSIGNMENT_NOT_ACTIVE' USING errcode='55000';
  END IF;

  SELECT * INTO v_request
  FROM rebuild_v2.medical_exception_requests r
  WHERE r.id=p_request_id AND r.assignment_id=v_assignment.id
  FOR UPDATE;
  IF NOT FOUND OR v_request.status<>'pending' THEN
    RAISE EXCEPTION 'MEDICAL_EXCEPTION_REQUEST_NOT_PENDING' USING errcode='55000';
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
  END IF;

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
        'status',v_request.status,
        'due_at',v_old_due_at,
        'medical_extension_days',v_old_extension_days
      ),
      'after',jsonb_build_object(
        'status',p_decision,
        'due_at',v_new_due_at,
        'medical_extension_days',v_new_extension_days
      )
    )
  );

  SELECT t.title INTO v_test_title
  FROM rebuild_v2.tests t WHERE t.id=v_assignment.test_id;

  PERFORM rebuild_v2_private.enqueue_notification_event(
    v_request.tester_id,
    'tester',
    'assignment.medical_exception_'||p_decision,
    CASE WHEN p_decision='approved' THEN 'Medical exception approved'
      ELSE 'Medical exception rejected' END,
    CASE WHEN p_decision='approved'
      THEN 'Your approved medical exception extends the assignment schedule by '
        ||v_days||' day(s).'
      ELSE 'Your medical exception request was rejected. The assignment schedule was not extended.' END,
    'medical_exception_request',
    v_request.id,
    jsonb_build_object(
      'assignment_id',v_assignment.id,
      'request_id',v_request.id,
      'decision',p_decision,
      'extension_days',v_days
    )
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.review_feedback_quality_impl(
  p_feedback_id uuid,
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
  v_feedback rebuild_v2.feedback%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_actor,ARRAY['admin']) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING errcode='42501';
  END IF;
  IF p_feedback_id IS NULL
     OR p_decision NOT IN ('accepted','rejected')
     OR p_review_note IS NULL
     OR char_length(btrim(p_review_note)) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'FEEDBACK_QUALITY_REVIEW_INPUT_INVALID' USING errcode='22023';
  END IF;

  SELECT * INTO v_feedback
  FROM rebuild_v2.feedback f
  WHERE f.id=p_feedback_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FEEDBACK_NOT_FOUND' USING errcode='P0002';
  END IF;
  IF v_feedback.tester_id=v_actor THEN
    RAISE EXCEPTION 'SELF_REVIEW_NOT_ALLOWED' USING errcode='42501';
  END IF;
  IF v_feedback.quality_status<>'pending'
     OR v_feedback.reviewed_by IS NOT NULL OR v_feedback.reviewed_at IS NOT NULL THEN
    RAISE EXCEPTION 'FEEDBACK_QUALITY_ALREADY_REVIEWED' USING errcode='55000';
  END IF;

  UPDATE rebuild_v2.feedback
  SET quality_status=p_decision,
      reviewed_by=v_actor,
      reviewed_at=now()
  WHERE id=v_feedback.id;

  INSERT INTO rebuild_v2.audit_events(
    actor_id,action,target_type,target_id,reason,metadata
  )
  VALUES(
    v_actor,
    'feedback.quality_'||p_decision,
    'feedback',
    v_feedback.id,
    btrim(p_review_note),
    jsonb_build_object(
      'assignment_id',v_feedback.assignment_id,
      'tester_id',v_feedback.tester_id,
      'before',jsonb_build_object('quality_status',v_feedback.quality_status),
      'after',jsonb_build_object('quality_status',p_decision)
    )
  );

  PERFORM rebuild_v2_private.enqueue_notification_event(
    v_feedback.tester_id,
    'tester',
    'feedback.quality_'||p_decision,
    CASE WHEN p_decision='accepted' THEN 'Feedback quality approved'
      ELSE 'Feedback quality not approved' END,
    CASE WHEN p_decision='accepted'
      THEN 'Your submitted feedback passed the TestDZ quality review.'
      ELSE 'Your submitted feedback did not pass the TestDZ quality review.' END,
    'feedback',
    v_feedback.id,
    jsonb_build_object(
      'feedback_id',v_feedback.id,
      'assignment_id',v_feedback.assignment_id,
      'quality_status',p_decision
    )
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_medical_exception_request(
  p_assignment_id uuid,p_reason text,p_requested_dates date[]
)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER
SET search_path TO '' SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.create_medical_exception_request_impl(
    p_assignment_id,p_reason,p_requested_dates
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.attach_medical_exception_evidence(
  p_request_id uuid,p_storage_path text
)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
SET search_path TO '' SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.attach_medical_exception_evidence_impl(
    p_request_id,p_storage_path
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.review_medical_exception(
  p_request_id uuid,p_decision text,p_review_note text
)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
SET search_path TO '' SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.review_medical_exception_impl(
    p_request_id,p_decision,p_review_note
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.review_feedback_quality(
  p_feedback_id uuid,p_decision text,p_review_note text
)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
SET search_path TO '' SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.review_feedback_quality_impl(
    p_feedback_id,p_decision,p_review_note
  );
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.create_medical_exception_request_impl(uuid,text,date[])
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.attach_medical_exception_evidence_impl(uuid,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.review_medical_exception_impl(uuid,text,text)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.review_feedback_quality_impl(uuid,text,text)
  FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION rebuild_v2.create_medical_exception_request(uuid,text,date[])
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.attach_medical_exception_evidence(uuid,text)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.review_medical_exception(uuid,text,text)
  FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.review_feedback_quality(uuid,text,text)
  FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION rebuild_v2.create_medical_exception_request(uuid,text,date[])
  TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.attach_medical_exception_evidence(uuid,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.review_medical_exception(uuid,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.review_feedback_quality(uuid,text,text)
  TO authenticated;

COMMENT ON FUNCTION rebuild_v2.review_medical_exception(uuid,text,text) IS
  'Admin-only medical exception decision; serialized with assignment activity and extends schedule once per approved date.';
COMMENT ON FUNCTION rebuild_v2.review_feedback_quality(uuid,text,text) IS
  'Admin-only quality decision distinct from developer feedback triage; records audit and tester notification.';

COMMIT;
