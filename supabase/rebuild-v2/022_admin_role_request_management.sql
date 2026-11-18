-- V2 candidate-only Admin role-request queue and audited review RPC.
-- Apply only after scripts 001..021 on a disposable database. Never apply to Production without cutover approval.
CREATE OR REPLACE FUNCTION rebuild_v2.admin_list_pending_role_requests()
RETURNS TABLE(request_id uuid,user_id uuid,requested_role text,request_reason text,created_at timestamptz,display_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' SET row_security TO 'off'
AS $function$
DECLARE v_actor uuid := auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT rebuild_v2_private.has_role(v_actor,ARRAY['admin']) THEN
  RAISE EXCEPTION 'ADMIN_REQUIRED' USING errcode='42501';
 END IF;
 RETURN QUERY SELECT rr.id,rr.user_id,rr.requested_role,rr.reason,rr.created_at,p.display_name
 FROM rebuild_v2.role_requests rr JOIN rebuild_v2.profiles p ON p.id=rr.user_id
 WHERE rr.status='pending' ORDER BY rr.created_at ASC,rr.id ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.admin_review_role_request(p_request_id uuid,p_decision text,p_review_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' SET row_security TO 'off'
AS $function$
DECLARE v_actor uuid := auth.uid(); v_target uuid;
BEGIN
 IF v_actor IS NULL OR NOT rebuild_v2_private.has_role(v_actor,ARRAY['admin']) THEN
  RAISE EXCEPTION 'ADMIN_REQUIRED' USING errcode='42501';
 END IF;
 IF p_request_id IS NULL OR p_decision NOT IN ('approved','rejected')
    OR p_review_note IS NULL OR char_length(btrim(p_review_note)) NOT BETWEEN 10 AND 1000 THEN
  RAISE EXCEPTION 'REVIEW_INPUT_INVALID' USING errcode='22023';
 END IF;
 SELECT user_id INTO v_target FROM rebuild_v2.role_requests
 WHERE id=p_request_id AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PENDING_ROLE_REQUEST_NOT_FOUND' USING errcode='P0002'; END IF;
 IF v_target=v_actor THEN RAISE EXCEPTION 'SELF_REVIEW_NOT_ALLOWED' USING errcode='42501'; END IF;
 PERFORM rebuild_v2_private.review_role_request(p_request_id,p_decision,btrim(p_review_note));
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2.admin_list_pending_role_requests() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.admin_review_role_request(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2.admin_list_pending_role_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.admin_review_role_request(uuid,text,text) TO authenticated;
