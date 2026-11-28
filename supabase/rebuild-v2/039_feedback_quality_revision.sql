-- Allow testers to correct feedback that Admin rejected for quality.
-- The original feedback row is retained; every revision is audited and re-enters
-- the pending quality queue. V2 candidate only.
BEGIN;

CREATE OR REPLACE FUNCTION rebuild_v2_private.revise_tester_feedback_impl(
  p_assignment_id uuid,
  p_category text,
  p_body text,
  p_rating smallint DEFAULT NULL
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
  v_feedback rebuild_v2.feedback%ROWTYPE;
  v_developer_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000';
  END IF;
  IF NOT rebuild_v2_private.has_role(v_actor,ARRAY['tester']) THEN
    RAISE EXCEPTION 'TESTER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_assignment_id IS NULL
     OR p_category IS NULL
     OR p_category NOT IN ('general','bug','usability','performance','compatibility')
     OR p_body IS NULL
     OR char_length(btrim(p_body)) NOT BETWEEN 20 AND 8000
     OR (p_rating IS NOT NULL AND p_rating NOT BETWEEN 1 AND 5) THEN
    RAISE EXCEPTION 'FEEDBACK_INPUT_INVALID' USING errcode='22023';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id=p_assignment_id
  FOR UPDATE;
  IF NOT FOUND OR v_assignment.tester_id<>v_actor THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING errcode='42501';
  END IF;
  IF v_assignment.status NOT IN ('active','completed') THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FEEDBACK_ELIGIBLE' USING errcode='55000';
  END IF;

  SELECT * INTO v_feedback
  FROM rebuild_v2.feedback f
  WHERE f.assignment_id=p_assignment_id
    AND f.tester_id=v_actor
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FEEDBACK_NOT_FOUND' USING errcode='P0002';
  END IF;
  IF v_feedback.quality_status<>'rejected'
     OR v_feedback.reviewed_by IS NULL OR v_feedback.reviewed_at IS NULL THEN
    RAISE EXCEPTION 'FEEDBACK_QUALITY_NOT_REVISABLE' USING errcode='55000';
  END IF;

  UPDATE rebuild_v2.feedback
  SET category=p_category,
      body=btrim(p_body),
      rating=p_rating,
      quality_status='pending',
      reviewed_by=NULL,
      reviewed_at=NULL
  WHERE id=v_feedback.id;

  SELECT t.developer_id INTO v_developer_id
  FROM rebuild_v2.tests t
  WHERE t.id=v_assignment.test_id;

  INSERT INTO rebuild_v2.audit_events(
    actor_id,action,target_type,target_id,reason,metadata
  )
  VALUES(
    v_actor,'feedback.quality_revised','feedback',v_feedback.id,
    'Tester revised feedback after an Admin quality rejection.',
    jsonb_build_object(
      'assignment_id',p_assignment_id,
      'before',jsonb_build_object(
        'quality_status',v_feedback.quality_status,
        'category',v_feedback.category,
        'body_length',char_length(v_feedback.body),
        'rating',v_feedback.rating
      ),
      'after',jsonb_build_object(
        'quality_status','pending',
        'category',p_category,
        'body_length',char_length(btrim(p_body)),
        'rating',p_rating
      )
    )
  );

  PERFORM rebuild_v2_private.enqueue_notification_event(
    v_developer_id,'developer','feedback.revised',
    'Tester revised feedback',
    'A tester revised feedback for your test after a quality review.',
    'feedback',v_feedback.id,
    jsonb_build_object(
      'feedback_id',v_feedback.id,
      'assignment_id',p_assignment_id,
      'test_id',v_assignment.test_id
    )
  );

  RETURN v_feedback.id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.revise_tester_feedback(
  p_assignment_id uuid,
  p_category text,
  p_body text,
  p_rating smallint DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT rebuild_v2_private.revise_tester_feedback_impl(
    p_assignment_id,p_category,p_body,p_rating
  );
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.revise_tester_feedback_impl(uuid,text,text,smallint)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rebuild_v2.revise_tester_feedback(uuid,text,text,smallint)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2.revise_tester_feedback(uuid,text,text,smallint)
  TO authenticated;

COMMENT ON FUNCTION rebuild_v2.revise_tester_feedback(uuid,text,text,smallint) IS
  'Tester-only revision path after Admin rejects feedback quality; preserves feedback identity and audit history and returns it to pending.';

COMMIT;
