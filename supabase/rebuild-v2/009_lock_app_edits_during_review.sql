-- Prevent developers from editing apps while pending moderation or after publication.
-- Candidate-only patch; apply to isolated FixLab after 008. Never Production without cutover approval.

CREATE OR REPLACE FUNCTION rebuild_v2_private.update_app_impl(
  p_app_id uuid,
  p_name text,
  p_description text,
  p_category text,
  p_icon_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','rebuild_v2','rebuild_v2_private','auth'
SET row_security TO 'off'
AS $function$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_user_id,ARRAY['developer','admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 3 AND 50
     OR p_description IS NULL OR char_length(btrim(p_description)) NOT BETWEEN 20 AND 500
     OR p_category IS NULL OR p_category NOT IN ('games','tools','education','social','health','other') THEN
    RAISE EXCEPTION 'APP_FIELDS_INVALID' USING errcode='22023';
  END IF;
  IF p_icon_url IS NOT NULL AND p_icon_url !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'APP_ICON_URL_INVALID' USING errcode='22023';
  END IF;
  UPDATE rebuild_v2.apps
  SET name=btrim(p_name),description=btrim(p_description),category=p_category,
      icon_url=CASE WHEN p_icon_url IS NULL THEN icon_url ELSE p_icon_url END,
      updated_at=now()
  WHERE id=p_app_id AND developer_id=v_user_id AND status IN ('draft','rejected');
  IF NOT FOUND THEN RAISE EXCEPTION 'APP_NOT_FOUND_OR_NOT_EDITABLE' USING errcode='P0002'; END IF;
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user_id,'app.updated','app',p_app_id,'Developer updated an editable app','{}'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.update_app_impl(uuid,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.update_app_impl(uuid,text,text,text,text) TO authenticated;
