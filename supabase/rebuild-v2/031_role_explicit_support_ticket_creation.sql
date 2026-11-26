-- Role-explicit support ticket creation for Developer and Tester workspaces.
-- Candidate only; apply after 030_developer_test_monitoring_summary.sql in disposable local DB.

CREATE OR REPLACE FUNCTION rebuild_v2_private.create_support_ticket_for_role_impl(
  p_requester_role text,
  p_subject text,
  p_category text,
  p_priority text,
  p_description text
)
RETURNS TABLE(
  id uuid,
  ticket_number bigint,
  subject text,
  category text,
  priority text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_ticket_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;
  IF p_requester_role IS NULL OR p_requester_role NOT IN ('tester','developer') THEN
    RAISE EXCEPTION 'invalid support requester role' USING errcode = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.user_roles ur
    WHERE ur.user_id = v_user_id AND ur.role = p_requester_role
  ) THEN
    RAISE EXCEPTION 'requested support workspace role is not granted' USING errcode = '42501';
  END IF;
  IF p_subject IS NULL OR char_length(btrim(p_subject)) NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'invalid support subject' USING errcode = '22023';
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('technical','account','testing','rewards','payments','other') THEN
    RAISE EXCEPTION 'invalid support category' USING errcode = '22023';
  END IF;
  IF p_priority IS NULL OR p_priority NOT IN ('normal','high','urgent') THEN
    RAISE EXCEPTION 'invalid support priority' USING errcode = '22023';
  END IF;
  IF p_description IS NULL OR char_length(btrim(p_description)) NOT BETWEEN 10 AND 5000 THEN
    RAISE EXCEPTION 'invalid support description' USING errcode = '22023';
  END IF;

  INSERT INTO rebuild_v2.support_tickets(
    user_id,requester_role,subject,category,priority,description,status
  ) VALUES (
    v_user_id,p_requester_role,btrim(p_subject),p_category,p_priority,btrim(p_description),'open'
  ) RETURNING support_tickets.id INTO v_ticket_id;

  INSERT INTO rebuild_v2.support_ticket_events(ticket_id,actor_id,event_type)
  VALUES(v_ticket_id,v_user_id,'created');

  RETURN QUERY
  SELECT st.id,st.ticket_number,st.subject,st.category,st.priority,st.status,st.created_at
  FROM rebuild_v2.support_tickets st WHERE st.id=v_ticket_id;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_support_ticket_for_role(
  p_requester_role text,
  p_subject text,
  p_category text,
  p_priority text,
  p_description text
)
RETURNS TABLE(
  id uuid,
  ticket_number bigint,
  subject text,
  category text,
  priority text,
  status text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM rebuild_v2_private.create_support_ticket_for_role_impl(
    p_requester_role,p_subject,p_category,p_priority,p_description
  );
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.create_support_ticket_for_role_impl(text,text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_support_ticket_for_role(text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.create_support_ticket_for_role_impl(text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_support_ticket_for_role(text,text,text,text,text) TO authenticated;
