-- Tester-visible developer replies, scoped to the authenticated feedback owner.
-- Candidate-only: applied by the isolated Rebuild V2 workflow; never run on hosted databases before cutover approval.

BEGIN;

CREATE OR REPLACE FUNCTION rebuild_v2_private.get_tester_feedback_messages_impl()
RETURNS TABLE(feedback_id uuid,body text,created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid:=auth.uid();
BEGIN
  IF v_user IS NULL OR NOT rebuild_v2_private.has_role(v_user,ARRAY['tester']) THEN
    RAISE EXCEPTION 'TESTER_ROLE_REQUIRED' USING errcode='42501';
  END IF;

  RETURN QUERY
  SELECT m.feedback_id,m.body,m.created_at
  FROM rebuild_v2.developer_feedback_messages m
  JOIN rebuild_v2.feedback f ON f.id=m.feedback_id
  JOIN rebuild_v2.assignments a ON a.id=f.assignment_id
  JOIN rebuild_v2.tests t ON t.id=a.test_id
  WHERE f.tester_id=v_user
    AND t.developer_id=m.sender_id
  ORDER BY m.created_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.get_tester_feedback_messages()
RETURNS TABLE(feedback_id uuid,body text,created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM rebuild_v2_private.get_tester_feedback_messages_impl();
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.get_tester_feedback_messages_impl() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.get_tester_feedback_messages() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.get_tester_feedback_messages_impl() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.get_tester_feedback_messages() TO authenticated;

COMMIT;
