-- Developer feedback inbox with strict test ownership and no tester identity exposure.
-- Candidate-only: apply to isolated TestDZ-FixLab after 015. Never Production before cutover approval.

-- Developers may manage their own tests, but must not read individual tester assignments,
-- check-in notes/evidence paths, or raw feedback rows through participant policies.
DROP POLICY IF EXISTS assignments_select_participants_v2 ON rebuild_v2.assignments;
CREATE POLICY assignments_select_tester_staff_v2
ON rebuild_v2.assignments
FOR SELECT TO authenticated
USING (
  tester_id=(SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()),ARRAY['admin','support'])
);

DROP POLICY IF EXISTS checkins_select_participants_v2 ON rebuild_v2.checkins;
CREATE POLICY checkins_select_tester_staff_v2
ON rebuild_v2.checkins
FOR SELECT TO authenticated
USING (
  tester_id=(SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()),ARRAY['admin','support'])
);

DROP POLICY IF EXISTS feedback_select_participants_v2 ON rebuild_v2.feedback;
CREATE POLICY feedback_select_tester_staff_v2
ON rebuild_v2.feedback
FOR SELECT TO authenticated
USING (
  tester_id=(SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()),ARRAY['admin','support'])
);

-- Developer workflow tables are read/written only through sanitized owner-checked RPCs.
REVOKE ALL ON TABLE
  rebuild_v2.developer_feedback_messages,
  rebuild_v2.developer_feedback_reviews,
  rebuild_v2.developer_feedback_events,
  rebuild_v2.developer_feedback_attachments
FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION rebuild_v2_private.get_developer_feedback_impl()
RETURNS TABLE(
  feedback_id uuid,
  test_id uuid,
  test_title text,
  app_name text,
  category text,
  body text,
  rating smallint,
  submitted_at timestamptz,
  review_status text,
  priority text,
  resolution_note text,
  resolved_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid:=auth.uid();
BEGIN
  IF v_user IS NULL OR NOT rebuild_v2_private.has_role(v_user,ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;

  RETURN QUERY
  SELECT f.id,t.id,t.title,app.name,f.category,f.body,f.rating,f.created_at,
         COALESCE(r.status,'new'),COALESCE(r.priority,'normal'),r.resolution_note,
         r.resolved_at,COALESCE(r.updated_at,f.created_at)
  FROM rebuild_v2.feedback f
  JOIN rebuild_v2.assignments a ON a.id=f.assignment_id
  JOIN rebuild_v2.tests t ON t.id=a.test_id
  JOIN rebuild_v2.apps app ON app.id=t.app_id
  LEFT JOIN rebuild_v2.developer_feedback_reviews r
    ON r.feedback_id=f.id AND r.developer_id=v_user
  WHERE t.developer_id=v_user
  ORDER BY f.created_at DESC;
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

  SELECT f.id INTO v_feedback_id
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

  RETURN v_review.id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.get_developer_feedback_messages_impl(p_feedback_id uuid)
RETURNS TABLE(sender_label text,body text,created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid:=auth.uid();
BEGIN
  IF v_user IS NULL OR NOT rebuild_v2_private.has_role(v_user,ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF NOT EXISTS(
    SELECT 1
    FROM rebuild_v2.feedback f
    JOIN rebuild_v2.assignments a ON a.id=f.assignment_id
    JOIN rebuild_v2.tests t ON t.id=a.test_id
    WHERE f.id=p_feedback_id AND t.developer_id=v_user
  ) THEN
    RAISE EXCEPTION 'FEEDBACK_NOT_FOUND_OR_NOT_OWNED' USING errcode='42501';
  END IF;

  RETURN QUERY
  SELECT CASE WHEN m.sender_id=v_user THEN 'You'::text ELSE 'Tester'::text END,
         m.body,m.created_at
  FROM rebuild_v2.developer_feedback_messages m
  WHERE m.feedback_id=p_feedback_id
  ORDER BY m.created_at ASC;
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
  v_message_id uuid;
BEGIN
  IF v_user IS NULL OR NOT rebuild_v2_private.has_role(v_user,ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_feedback_id IS NULL OR p_body IS NULL
     OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'DEVELOPER_FEEDBACK_MESSAGE_INVALID' USING errcode='22023';
  END IF;
  IF NOT EXISTS(
    SELECT 1
    FROM rebuild_v2.feedback f
    JOIN rebuild_v2.assignments a ON a.id=f.assignment_id
    JOIN rebuild_v2.tests t ON t.id=a.test_id
    WHERE f.id=p_feedback_id AND t.developer_id=v_user
  ) THEN
    RAISE EXCEPTION 'FEEDBACK_NOT_FOUND_OR_NOT_OWNED' USING errcode='42501';
  END IF;

  INSERT INTO rebuild_v2.developer_feedback_messages(feedback_id,sender_id,body)
  VALUES(p_feedback_id,v_user,btrim(p_body))
  RETURNING id INTO v_message_id;
  INSERT INTO rebuild_v2.developer_feedback_events(feedback_id,actor_id,event_type)
  VALUES(p_feedback_id,v_user,'message_sent');
  RETURN v_message_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.get_developer_feedback()
RETURNS TABLE(
  feedback_id uuid,test_id uuid,test_title text,app_name text,category text,body text,
  rating smallint,submitted_at timestamptz,review_status text,priority text,
  resolution_note text,resolved_at timestamptz,updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM rebuild_v2_private.get_developer_feedback_impl();
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.update_developer_feedback_review(
  p_feedback_id uuid,p_status text,p_priority text,p_resolution_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.update_developer_feedback_review_impl(
    p_feedback_id,p_status,p_priority,p_resolution_note
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.get_developer_feedback_messages(p_feedback_id uuid)
RETURNS TABLE(sender_label text,body text,created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM rebuild_v2_private.get_developer_feedback_messages_impl(p_feedback_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.send_developer_feedback_message(p_feedback_id uuid,p_body text)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.send_developer_feedback_message_impl(p_feedback_id,p_body);
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.get_developer_feedback_impl() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.update_developer_feedback_review_impl(uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.get_developer_feedback_messages_impl(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.send_developer_feedback_message_impl(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.get_developer_feedback() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.update_developer_feedback_review(uuid,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.get_developer_feedback_messages(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.send_developer_feedback_message(uuid,text) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION rebuild_v2_private.get_developer_feedback_impl() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.update_developer_feedback_review_impl(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.get_developer_feedback_messages_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.send_developer_feedback_message_impl(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.get_developer_feedback() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.update_developer_feedback_review(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.get_developer_feedback_messages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.send_developer_feedback_message(uuid,text) TO authenticated;
