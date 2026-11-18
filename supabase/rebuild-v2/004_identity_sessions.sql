-- TestDZ rebuild v2 onboarding and account-security RPCs.
-- Apply after 001_schema.sql, 002_security.sql and 003_app_lifecycle.sql in an isolated test database.
-- No active migration is created; this remains a rebuild candidate script.

CREATE OR REPLACE FUNCTION rebuild_v2_private.complete_onboarding_impl(
  p_roles text[],
  p_interests jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'rebuild_v2', 'auth'
SET row_security TO 'off'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_interests jsonb := coalesce(p_interests, '[]'::jsonb);
  v_developer_request_id uuid;
  v_actual_roles text[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING errcode = '42501';
  END IF;

  IF p_roles IS NULL
     OR cardinality(p_roles) NOT BETWEEN 1 AND 2
     OR EXISTS (
       SELECT 1
       FROM unnest(p_roles) AS requested(role_name)
       WHERE requested.role_name NOT IN ('tester', 'developer')
     )
     OR cardinality(p_roles) <> (SELECT count(DISTINCT role_name) FROM unnest(p_roles) AS requested(role_name)) THEN
    RAISE EXCEPTION 'invalid role selection' USING errcode = '22023';
  END IF;

  IF jsonb_typeof(v_interests) <> 'array' THEN
    RAISE EXCEPTION 'invalid interests' USING errcode = '22023';
  END IF;

  IF jsonb_array_length(v_interests) > 20 THEN
    RAISE EXCEPTION 'invalid interests' USING errcode = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_interests) AS item(value)
    WHERE jsonb_typeof(item.value) <> 'string'
       OR char_length(item.value #>> '{}') > 80
  ) THEN
    RAISE EXCEPTION 'invalid interest item' USING errcode = '22023';
  END IF;

  -- Onboarding may establish the baseline tester role, but it must never
  -- grant or revoke privileged roles. Developer access is request-and-review only.
  INSERT INTO rebuild_v2.user_roles(user_id, role)
  VALUES (v_user_id, 'tester')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF 'developer' = ANY(p_roles)
     AND NOT EXISTS (
       SELECT 1 FROM rebuild_v2.user_roles
       WHERE user_id = v_user_id AND role = 'developer'
     ) THEN
    v_developer_request_id :=
      rebuild_v2_private.request_developer_role('Requested during onboarding');
  END IF;

  SELECT coalesce(array_agg(role ORDER BY role), ARRAY[]::text[])
  INTO v_actual_roles
  FROM rebuild_v2.user_roles
  WHERE user_id = v_user_id;

  UPDATE rebuild_v2.profiles
  SET interests = v_interests,
      onboarding_completed_at = now(),
      updated_at = now()
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING errcode = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'roles', to_jsonb(v_actual_roles),
    'developer_request_id', v_developer_request_id,
    'developer_access', CASE
      WHEN 'developer' = ANY(v_actual_roles) THEN 'approved'
      WHEN v_developer_request_id IS NOT NULL THEN 'pending'
      ELSE 'not_requested'
    END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.get_my_active_sessions_impl()
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip_address text,
  assurance_level text,
  is_current boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'auth'
SET row_security TO 'off'
AS $function$
  SELECT
    s.id,
    s.created_at,
    coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) AS last_active_at,
    s.user_agent,
    CASE WHEN s.ip IS NULL THEN NULL ELSE host(s.ip) END AS ip_address,
    s.aal::text AS assurance_level,
    s.id::text = (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id'
    ) AS is_current
  FROM auth.sessions s
  WHERE auth.uid() IS NOT NULL
    AND s.user_id = auth.uid()
    AND (s.not_after IS NULL OR s.not_after > now())
  ORDER BY is_current DESC, last_active_at DESC;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.get_my_security_activity_impl(p_limit integer DEFAULT 30)
RETURNS TABLE(id uuid, event text, occurred_at timestamptz, ip_address text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'auth'
SET row_security TO 'off'
AS $function$
  SELECT
    ale.id,
    coalesce(ale.payload ->> 'action', ale.payload ->> 'event', 'Authentication event') AS event,
    ale.created_at AS occurred_at,
    nullif(ale.ip_address, '') AS ip_address
  FROM auth.audit_log_entries ale
  WHERE auth.uid() IS NOT NULL
    AND coalesce(ale.payload ->> 'actor_id', ale.payload ->> 'user_id') = auth.uid()::text
  ORDER BY ale.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 30), 100));
$function$;

-- Exposed-schema wrappers contain no privileged logic.
CREATE OR REPLACE FUNCTION rebuild_v2.complete_onboarding(
  p_roles text[],
  p_interests jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.complete_onboarding_impl(p_roles, p_interests);
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.get_my_active_sessions()
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip_address text,
  assurance_level text,
  is_current boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM rebuild_v2_private.get_my_active_sessions_impl();
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.get_my_security_activity(p_limit integer DEFAULT 30)
RETURNS TABLE(id uuid, event text, occurred_at timestamptz, ip_address text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT * FROM rebuild_v2_private.get_my_security_activity_impl(p_limit);
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.complete_onboarding_impl(text[], jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.get_my_active_sessions_impl() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.get_my_security_activity_impl(integer) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION rebuild_v2.complete_onboarding(text[], jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.get_my_active_sessions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2.get_my_security_activity(integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION rebuild_v2_private.complete_onboarding_impl(text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.get_my_active_sessions_impl() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.get_my_security_activity_impl(integer) TO authenticated;

GRANT EXECUTE ON FUNCTION rebuild_v2.complete_onboarding(text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.get_my_active_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.get_my_security_activity(integer) TO authenticated;
