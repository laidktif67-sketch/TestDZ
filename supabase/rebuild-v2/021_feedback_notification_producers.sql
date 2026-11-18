-- Trusted notification producers for tester feedback and developer feedback replies.
-- This is candidate V2 SQL only. Apply only through the isolated rebuild-v2 replay.
BEGIN;

CREATE OR REPLACE FUNCTION rebuild_v2_private.submit_tester_feedback_impl(
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
  v_user_id uuid := (SELECT auth.uid());
  v_assignment rebuild_v2.assignments%ROWTYPE;
  v_feedback_id uuid;
  v_developer_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;
  IF p_assignment_id IS NULL
     OR p_category IS NULL
     OR p_category NOT IN ('general','bug','usability','performance','compatibility')
     OR p_body IS NULL
     OR char_length(btrim(p_body)) NOT BETWEEN 20 AND 8000
     OR (p_rating IS NOT NULL AND p_rating NOT BETWEEN 1 AND 5) THEN
    RAISE EXCEPTION 'FEEDBACK_INPUT_INVALID' USING errcode = '22023';
  END IF;

  SELECT * INTO v_assignment
  FROM rebuild_v2.assignments a
  WHERE a.id = p_assignment_id
  FOR UPDATE;
  IF NOT FOUND OR v_assignment.tester_id <> v_user_id THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING errcode = '42501';
  END IF;
  IF v_assignment.status NOT IN ('active','completed') THEN
    RAISE EXCEPTION 'ASSIGNMENT_NOT_FEEDBACK_ELIGIBLE' USING errcode = '55000';
  END IF;

  SELECT t.developer_id INTO v_developer_id
  FROM rebuild_v2.tests t
  WHERE t.id = v_assignment.test_id;

  INSERT INTO rebuild_v2.feedback(assignment_id, tester_id, category, body, rating)
  VALUES (p_assignment_id, v_user_id, p_category, btrim(p_body), p_rating)
  RETURNING id INTO v_feedback_id;

  PERFORM rebuild_v2_private.enqueue_notification_event(
    v_developer_id,
    'developer',
    'feedback.created',
    'New tester feedback',
    'A tester submitted feedback for your test.',
    'feedback',
    v_feedback_id,
    jsonb_build_object('feedback_id',v_feedback_id,'test_id',v_assignment.test_id)
  );

  RETURN v_feedback_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.update_developer_feedback_review_impl(
  p_feedback_id uuid,
  p_status text,
  p_priority text,
  p_resolution_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_feedback_id uuid;
  v_tester_id uuid;
  v_test_id uuid;
  v_review rebuild_v2.developer_feedback_reviews%ROWTYPE;
  v_old_status text;
  v_old_priority text;
  v_note text:=NULLIF(btrim(p_resolution_note),'');
BEGIN
  IF v_user IS NULL OR NOT rebuild_v2_private.has_role(v_user,ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_feedback_id IS NULL
     OR p_status NOT IN ('new','under_review','planned','resolved','wont_fix')
     OR p_priority NOT IN ('low','normal','high','urgent') THEN
    RAISE EXCEPTION 'DEVELOPER_FEEDBACK_REVIEW_INPUT_INVALID' USING errcode='22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note)>2000 THEN
    RAISE EXCEPTION 'DEVELOPER_FEEDBACK_RESOLUTION_NOTE_INVALID' USING errcode='22023';
  END IF;
  IF p_status IN ('resolved','wont_fix') AND char_length(COALESCE(v_note,''))<5 THEN
    RAISE EXCEPTION 'RESOLUTION_NOTE_REQUIRED' USING errcode='22023';
  END IF;

  SELECT f.id,f.tester_id,t.id INTO v_feedback_id,v_tester_id,v_test_id
  FROM rebuild_v2.feedback f
  JOIN rebuild_v2.assignments a ON a.id=f.assignment_id
  JOIN rebuild_v2.tests t ON t.id=a.test_id
  WHERE f.id=p_feedback_id AND t.developer_id=v_user
  FOR UPDATE OF f;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FEEDBACK_NOT_FOUND_OR_NOT_OWNED' USING errcode='42501';
  END IF;

  SELECT * INTO v_review
  FROM rebuild_v2.developer_feedback_reviews
  WHERE feedback_id=p_feedback_id AND developer_id=v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO rebuild_v2.developer_feedback_reviews(
      feedback_id,developer_id,status,priority,resolution_note,resolved_at,updated_at
    ) VALUES (
      p_feedback_id,v_user,p_status,p_priority,v_note,
      CASE WHEN p_status IN ('resolved','wont_fix') THEN now() ELSE NULL END,now()
    ) RETURNING * INTO v_review;
    INSERT INTO rebuild_v2.developer_feedback_events(feedback_id,actor_id,event_type,new_value)
    VALUES(p_feedback_id,v_user,'created','status='||p_status||';priority='||p_priority);
    v_old_status := NULL;
  ELSE
    v_old_status:=v_review.status;
    v_old_priority:=v_review.priority;
    UPDATE rebuild_v2.developer_feedback_reviews
    SET status=p_status,
        priority=p_priority,
        resolution_note=v_note,
        resolved_at=CASE WHEN p_status IN ('resolved','wont_fix') THEN COALESCE(resolved_at,now()) ELSE NULL END,
        updated_at=now()
    WHERE id=v_review.id
    RETURNING * INTO v_review;

    IF v_old_status IS DISTINCT FROM p_status THEN
      INSERT INTO rebuild_v2.developer_feedback_events(feedback_id,actor_id,event_type,old_value,new_value)
      VALUES(p_feedback_id,v_user,'status_changed',v_old_status,p_status);
    END IF;
    IF v_old_priority IS DISTINCT FROM p_priority THEN
      INSERT INTO rebuild_v2.developer_feedback_events(feedback_id,actor_id,event_type,old_value,new_value)
      VALUES(p_feedback_id,v_user,'priority_changed',v_old_priority,p_priority);
    END IF;
  END IF;

  IF v_old_status IS DISTINCT FROM p_status THEN
    PERFORM rebuild_v2_private.enqueue_notification_event(
      v_tester_id,
      'tester',
      'feedback.status_updated',
      'Feedback status updated',
      'Your feedback status is now: '||p_status||'.',
      'feedback',
      v_feedback_id,
      jsonb_build_object('feedback_id',v_feedback_id,'test_id',v_test_id,'status',p_status)
    );
  END IF;

  RETURN v_review.id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.send_developer_feedback_message_impl(
  p_feedback_id uuid,p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_tester_id uuid;
  v_test_id uuid;
  v_message_id uuid;
BEGIN
  IF v_user IS NULL OR NOT rebuild_v2_private.has_role(v_user,ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_feedback_id IS NULL OR p_body IS NULL
     OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'DEVELOPER_FEEDBACK_MESSAGE_INVALID' USING errcode='22023';
  END IF;

  SELECT f.tester_id,t.id INTO v_tester_id,v_test_id
  FROM rebuild_v2.feedback f
  JOIN rebuild_v2.assignments a ON a.id=f.assignment_id
  JOIN rebuild_v2.tests t ON t.id=a.test_id
  WHERE f.id=p_feedback_id AND t.developer_id=v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FEEDBACK_NOT_FOUND_OR_NOT_OWNED' USING errcode='42501';
  END IF;

  INSERT INTO rebuild_v2.developer_feedback_messages(feedback_id,sender_id,body)
  VALUES(p_feedback_id,v_user,btrim(p_body))
  RETURNING id INTO v_message_id;
  INSERT INTO rebuild_v2.developer_feedback_events(feedback_id,actor_id,event_type)
  VALUES(p_feedback_id,v_user,'message_sent');

  PERFORM rebuild_v2_private.enqueue_notification_event(
    v_tester_id,
    'tester',
    'feedback.developer_replied',
    'Developer replied',
    'A developer replied to your feedback.',
    'feedback',
    p_feedback_id,
    jsonb_build_object('feedback_id',p_feedback_id,'test_id',v_test_id,'message_id',v_message_id)
  );

  RETURN v_message_id;
END;
$function$;

COMMIT;
