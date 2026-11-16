-- Read-only security contract for the completed Rebuild V2 schema.
-- Protects the SECURITY DEFINER search-path and schema-creation boundaries.

DO $contract$
DECLARE
  v_missing_search_path integer;
  v_unsafe_search_path integer;
  v_writable_path_schemas integer;
  v_non_postgres_definers integer;
BEGIN
  IF NOT has_schema_privilege('authenticated', 'rebuild_v2', 'USAGE') THEN
    RAISE EXCEPTION 'authenticated must retain USAGE on rebuild_v2 for invoker wrappers';
  END IF;

  IF NOT has_schema_privilege('authenticated', 'rebuild_v2_private', 'USAGE') THEN
    RAISE EXCEPTION 'authenticated must retain USAGE on rebuild_v2_private for invoker wrappers';
  END IF;

  IF has_schema_privilege('anon', 'rebuild_v2', 'USAGE')
     OR has_schema_privilege('anon', 'rebuild_v2_private', 'USAGE') THEN
    RAISE EXCEPTION 'anon must not have USAGE on either V2 application schema';
  END IF;

  IF has_function_privilege('authenticated',
       'rebuild_v2_private.grant_role(uuid,text,text)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated',
       'rebuild_v2_private.request_developer_role(text)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated',
       'rebuild_v2_private.review_role_request(uuid,text,text)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not directly execute unwrapped role-management implementations';
  END IF;

  IF NOT has_function_privilege('authenticated',
       'rebuild_v2_private.post_wallet_entry(uuid,text,bigint,text,text,text,text,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated financial context must retain wallet posting EXECUTE for the idempotency contract';
  END IF;

  IF has_function_privilege('anon',
       'rebuild_v2_private.grant_role(uuid,text,text)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon',
       'rebuild_v2_private.post_wallet_entry(uuid,text,bigint,text,text,text,text,uuid)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon',
       'rebuild_v2_private.request_developer_role(text)'::regprocedure, 'EXECUTE')
     OR has_function_privilege('anon',
       'rebuild_v2_private.review_role_request(uuid,text,text)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute privileged private implementations';
  END IF;

  SELECT count(*) INTO v_writable_path_schemas
  FROM pg_namespace n
  CROSS JOIN (
    VALUES ('anon'), ('authenticated'), ('service_role'), ('authenticator')
  ) AS roles(role_name)
  WHERE n.nspname IN (
    'pg_catalog', 'rebuild_v2', 'rebuild_v2_private', 'auth', 'storage'
  )
    AND has_schema_privilege(roles.role_name::name, n.nspname::name, 'CREATE');

  IF v_writable_path_schemas <> 0 THEN
    RAISE EXCEPTION 'untrusted roles must not have CREATE on SECURITY DEFINER search-path schemas; found % grants',
      v_writable_path_schemas;
  END IF;

  SELECT count(*) INTO v_missing_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('rebuild_v2', 'rebuild_v2_private')
    AND p.prosecdef
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(setting)
      WHERE cfg.setting LIKE 'search_path=%'
    );

  IF v_missing_search_path <> 0 THEN
    RAISE EXCEPTION 'all SECURITY DEFINER functions require an explicit search_path; missing on % functions',
      v_missing_search_path;
  END IF;

  SELECT count(*) INTO v_unsafe_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(setting)
  CROSS JOIN LATERAL regexp_split_to_table(
    substring(cfg.setting FROM length('search_path=') + 1),
    '\s*,\s*'
  ) AS path(schema_name)
  WHERE n.nspname IN ('rebuild_v2', 'rebuild_v2_private')
    AND p.prosecdef
    AND cfg.setting LIKE 'search_path=%'
    AND replace(trim(path.schema_name), '"', '') <> ''
    AND replace(trim(path.schema_name), '"', '') NOT IN (
      'pg_catalog', 'rebuild_v2', 'rebuild_v2_private', 'auth', 'storage'
    );

  IF v_unsafe_search_path <> 0 THEN
    RAISE EXCEPTION 'SECURITY DEFINER search_path contains an unapproved schema on % functions',
      v_unsafe_search_path;
  END IF;

  SELECT count(*) INTO v_non_postgres_definers
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE n.nspname IN ('rebuild_v2', 'rebuild_v2_private')
    AND p.prosecdef
    AND r.rolname <> 'postgres';

  IF v_non_postgres_definers <> 0 THEN
    RAISE EXCEPTION 'all V2 SECURITY DEFINER functions must remain owned by postgres; found % exceptions',
      v_non_postgres_definers;
  END IF;
END;
$contract$;

SELECT 'rebuild_v2_security_definer_boundary_contract: PASS' AS result;
