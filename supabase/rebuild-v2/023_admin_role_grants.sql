-- Candidate-only Admin role grant boundary.
-- Apply after 001..022 on a disposable local Supabase database only.
-- No Admin role can be granted through this client-facing wrapper.
CREATE OR REPLACE FUNCTION rebuild_v2_private.grant_role(p_user_id uuid, p_role text, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private'
SET row_security TO 'off'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_inserted integer;
BEGIN
  IF v_actor IS NULL OR NOT rebuild_v2_private.has_role(v_actor, ARRAY['admin']) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING errcode = '42501';
  END IF;

  IF p_user_id IS NULL OR p_role IS NULL
     OR p_role NOT IN ('tester', 'developer', 'financial', 'support') THEN
    RAISE EXCEPTION 'ROLE_ASSIGNMENT_INVALID' USING errcode = '22023';
  END IF;

  IF p_user_id = v_actor THEN
    RAISE EXCEPTION 'SELF_ROLE_GRANT_NOT_ALLOWED' USING errcode = '42501';
  END IF;

  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 10 OR char_length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'ROLE_GRANT_REASON_INVALID' USING errcode = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rebuild_v2.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'TARGET_PROFILE_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  INSERT INTO rebuild_v2.user_roles(user_id, role, granted_by)
  VALUES (p_user_id, p_role, v_actor)
  ON CONFLICT (user_id, role) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN;
  END IF;

  INSERT INTO rebuild_v2.audit_events(actor_id, action, target_type, target_id, reason, metadata)
  VALUES (
    v_actor,
    'role.grant',
    'user',
    p_user_id,
    btrim(p_reason),
    jsonb_build_object('role', p_role)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.admin_grant_role(p_user_id uuid, p_role text, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT rebuild_v2_private.has_role(v_actor, ARRAY['admin']) THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED' USING errcode = '42501';
  END IF;

  PERFORM rebuild_v2_private.grant_role(p_user_id, p_role, p_reason);
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.grant_role(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2.admin_grant_role(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.admin_grant_role(uuid, text, text) TO authenticated;
