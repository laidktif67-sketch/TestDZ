-- TestDZ rebuild v2 developer app lifecycle API.
-- Apply after 001_schema.sql and 002_security.sql in an isolated test database.
-- Keep this file outside supabase/migrations until compatibility and cutover approval.

CREATE OR REPLACE FUNCTION rebuild_v2_private.get_active_subscription()
RETURNS TABLE(plan_code text, features jsonb, limits jsonb, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'auth'
SET row_security TO 'off'
AS $function$
  SELECT p.code, p.features, p.limits, s.current_period_end
  FROM rebuild_v2.subscriptions s
  JOIN rebuild_v2.plans p ON p.id = s.plan_id
  WHERE auth.uid() IS NOT NULL
    AND s.user_id = auth.uid()
    AND s.status IN ('active', 'trialing')
    AND s.current_period_end > now()
  ORDER BY s.current_period_end DESC
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.get_app_limit_impl()
RETURNS TABLE(plan_code text, max_active_apps integer, current_active_apps integer, can_create boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan_code text;
  v_limits jsonb;
  v_max integer;
  v_used integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  SELECT s.plan_code, s.limits INTO v_plan_code, v_limits
  FROM rebuild_v2_private.get_active_subscription() s
  LIMIT 1;

  IF v_plan_code IS NULL THEN
    SELECT p.code, p.limits INTO v_plan_code, v_limits
    FROM rebuild_v2.plans p
    WHERE p.code = 'free' AND p.is_active
    LIMIT 1;
  END IF;

  v_plan_code := coalesce(v_plan_code, 'free');
  v_max := greatest(0, coalesce((v_limits ->> 'max_active_apps')::integer, 1));

  SELECT count(*)::integer INTO v_used
  FROM rebuild_v2.apps a
  WHERE a.developer_id = v_user_id AND a.status <> 'archived';

  RETURN QUERY SELECT v_plan_code, v_max, v_used, (v_used < v_max);
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.create_app_impl(
  p_name text,
  p_package_name text,
  p_description text,
  p_category text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_limits jsonb;
  v_max integer;
  v_used integer;
  v_app_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  IF NOT rebuild_v2_private.has_role(v_user_id, ARRAY['developer', 'admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode = '42501';
  END IF;

  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 3 AND 50 THEN
    RAISE EXCEPTION 'APP_NAME_INVALID' USING errcode = '22023';
  END IF;

  IF p_description IS NULL OR char_length(btrim(p_description)) NOT BETWEEN 20 AND 500 THEN
    RAISE EXCEPTION 'APP_DESCRIPTION_INVALID' USING errcode = '22023';
  END IF;

  IF p_package_name IS NULL OR p_package_name !~ '^[a-z][a-z0-9_]*([.][a-z][a-z0-9_]*)+$' THEN
    RAISE EXCEPTION 'PACKAGE_NAME_INVALID' USING errcode = '22023';
  END IF;

  IF p_category IS NULL OR p_category NOT IN ('games', 'tools', 'education', 'social', 'health', 'other') THEN
    RAISE EXCEPTION 'APP_CATEGORY_INVALID' USING errcode = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  SELECT s.limits INTO v_limits
  FROM rebuild_v2_private.get_active_subscription() s
  LIMIT 1;

  IF v_limits IS NULL THEN
    SELECT p.limits INTO v_limits
    FROM rebuild_v2.plans p
    WHERE p.code = 'free' AND p.is_active
    LIMIT 1;
  END IF;

  v_max := greatest(0, coalesce((v_limits ->> 'max_active_apps')::integer, 1));

  SELECT count(*)::integer INTO v_used
  FROM rebuild_v2.apps
  WHERE developer_id = v_user_id AND status <> 'archived';

  IF v_used >= v_max THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED'
      USING errcode = 'P0001',
      DETAIL = jsonb_build_object('used', v_used, 'limit', v_max)::text;
  END IF;

  INSERT INTO rebuild_v2.apps(developer_id, name, package_name, description, category, status)
  VALUES (v_user_id, btrim(p_name), lower(btrim(p_package_name)), btrim(p_description), p_category, 'draft')
  RETURNING id INTO v_app_id;

  RETURN v_app_id;
END;
$function$;

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
SET search_path TO 'pg_catalog', 'rebuild_v2', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 3 AND 50
     OR p_description IS NULL OR char_length(btrim(p_description)) NOT BETWEEN 20 AND 500
     OR p_category IS NULL OR p_category NOT IN ('games', 'tools', 'education', 'social', 'health', 'other') THEN
    RAISE EXCEPTION 'APP_FIELDS_INVALID' USING errcode = '22023';
  END IF;

  IF p_icon_url IS NOT NULL AND p_icon_url !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'APP_ICON_URL_INVALID' USING errcode = '22023';
  END IF;

  UPDATE rebuild_v2.apps
  SET name = btrim(p_name),
      description = btrim(p_description),
      category = p_category,
      icon_url = CASE WHEN p_icon_url IS NULL THEN icon_url ELSE p_icon_url END,
      updated_at = now()
  WHERE id = p_app_id AND developer_id = v_user_id AND status <> 'archived';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APP_NOT_FOUND_OR_NOT_OWNED' USING errcode = 'P0002';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.archive_app_impl(p_app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  UPDATE rebuild_v2.apps
  SET archived_from_status = status,
      status = 'archived',
      updated_at = now()
  WHERE id = p_app_id AND developer_id = v_user_id AND status <> 'archived';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APP_NOT_FOUND_OR_ALREADY_ARCHIVED' USING errcode = 'P0002';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.restore_app_impl(p_app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_limits jsonb;
  v_max integer;
  v_used integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));

  SELECT s.limits INTO v_limits
  FROM rebuild_v2_private.get_active_subscription() s
  LIMIT 1;

  IF v_limits IS NULL THEN
    SELECT p.limits INTO v_limits
    FROM rebuild_v2.plans p
    WHERE p.code = 'free' AND p.is_active
    LIMIT 1;
  END IF;

  v_max := greatest(0, coalesce((v_limits ->> 'max_active_apps')::integer, 1));

  SELECT count(*)::integer INTO v_used
  FROM rebuild_v2.apps
  WHERE developer_id = v_user_id AND status <> 'archived';

  IF v_used >= v_max THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED' USING errcode = 'P0001';
  END IF;

  UPDATE rebuild_v2.apps
  SET status = coalesce(archived_from_status, 'draft'),
      archived_from_status = NULL,
      updated_at = now()
  WHERE id = p_app_id AND developer_id = v_user_id AND status = 'archived';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APP_NOT_FOUND_OR_NOT_ARCHIVED' USING errcode = 'P0002';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.get_app_limit()
RETURNS TABLE(plan_code text, max_active_apps integer, current_active_apps integer, can_create boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM rebuild_v2_private.get_app_limit_impl();
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.create_app(
  p_name text, p_package_name text, p_description text, p_category text
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.create_app_impl(p_name, p_package_name, p_description, p_category);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.update_app(
  p_app_id uuid, p_name text, p_description text, p_category text, p_icon_url text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.update_app_impl(p_app_id, p_name, p_description, p_category, p_icon_url);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.archive_app(p_app_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.archive_app_impl(p_app_id);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.restore_app(p_app_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.restore_app_impl(p_app_id);
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.get_active_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rebuild_v2_private.get_app_limit_impl() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.create_app_impl(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.update_app_impl(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.archive_app_impl(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.restore_app_impl(uuid) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION rebuild_v2.get_app_limit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.create_app(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.update_app(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.archive_app(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.restore_app(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION rebuild_v2_private.get_app_limit_impl() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.create_app_impl(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.update_app_impl(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.archive_app_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.restore_app_impl(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION rebuild_v2.get_app_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.create_app(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.update_app(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.archive_app(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.restore_app(uuid) TO authenticated;
