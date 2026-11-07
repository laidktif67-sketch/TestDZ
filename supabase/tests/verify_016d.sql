-- Read-only post-apply verification for 016d. Does not create or mutate cohorts.
DO $verify$
DECLARE v_proc_count integer; v_bad_security integer; v_bad_search_path integer; v_bad_grants integer;
BEGIN
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>19 THEN RAISE EXCEPTION 'Expected exactly 19 migration history rows after 016d'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261108000100')<>1 THEN RAISE EXCEPTION '016d migration history row missing or duplicated'; END IF;
 WITH expected(signature) AS (VALUES
  ('public.create_cohort(text,integer,uuid[])'),
  ('public.add_cohort_test(uuid,uuid)'),
  ('public.remove_cohort_test(uuid,uuid)'))
 SELECT count(*) INTO v_proc_count FROM expected e JOIN pg_proc p ON p.oid=to_regprocedure(e.signature);
 IF v_proc_count<>3 THEN RAISE EXCEPTION 'Expected all 3 016d RPC signatures; found %',v_proc_count; END IF;
 SELECT count(*) INTO v_bad_security FROM pg_proc p
 WHERE p.oid IN(to_regprocedure('public.create_cohort(text,integer,uuid[])'),to_regprocedure('public.add_cohort_test(uuid,uuid)'),to_regprocedure('public.remove_cohort_test(uuid,uuid)'))
 AND NOT p.prosecdef;
 IF v_bad_security<>0 THEN RAISE EXCEPTION 'SECURITY DEFINER violations=%',v_bad_security; END IF;
 SELECT count(*) INTO v_bad_search_path FROM pg_proc p
 WHERE p.oid IN(to_regprocedure('public.create_cohort(text,integer,uuid[])'),to_regprocedure('public.add_cohort_test(uuid,uuid)'),to_regprocedure('public.remove_cohort_test(uuid,uuid)'))
 AND NOT EXISTS(SELECT 1 FROM unnest(COALESCE(p.proconfig,ARRAY[]::text[])) AS cfg(setting)
  WHERE split_part(setting,'=',1)='search_path' AND regexp_replace(setting,'^search_path=','') IN('','""'));
 IF v_bad_search_path<>0 THEN RAISE EXCEPTION 'Empty search_path violations=%',v_bad_search_path; END IF;
 SELECT count(*) INTO v_bad_grants FROM pg_proc p
 WHERE p.oid IN(to_regprocedure('public.create_cohort(text,integer,uuid[])'),to_regprocedure('public.add_cohort_test(uuid,uuid)'),to_regprocedure('public.remove_cohort_test(uuid,uuid)'))
 AND (NOT has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE')
 OR EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE'));
 IF v_bad_grants<>0 THEN RAISE EXCEPTION 'Function grant violations=%',v_bad_grants; END IF;
END
$verify$;
