-- Read-only fingerprint of the final V2 catalog.
-- Run after all 23 candidate scripts (001..023). Excludes the known live/candidate date-delta functions:
-- Known date deltas: candidate-only algeria_local_date, four tester business-date implementations, and checkins.checkin_date's Algeria-local default. Also excludes legacy Storage policies inherited from supabase/migrations (only *_v2 policies are part of this V2 fingerprint) and app-icons runtime metadata because the clean local replay retains 512000 bytes from the earlier legacy migration while V2 script 006 requests 524288 and uses ON CONFLICT DO NOTHING; verify the live FixLab value independently before parity claims.
-- Also excludes two CHECK constraints whose expressions differ only in redundant parenthesis grouping; their full definitions are emitted by catalog_difference_details.sql. This is a diagnostic fingerprint, not proof of FixLab parity; compare outputs from both environments and review every excluded delta. Compare this output with the same query on FixLab before any hosted baseline or patch operation.

WITH
cols AS (
 SELECT c.relname||'.'||a.attname||':'||format_type(a.atttypid,a.atttypmod)||':'||
        a.attnotnull::text||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),'')||':'||
        a.attidentity::text||':'||a.attgenerated::text AS item
 FROM pg_attribute a
 JOIN pg_class c ON c.oid=a.attrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE n.nspname='rebuild_v2' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
   AND NOT (c.relname='checkins' AND a.attname='checkin_date')
),
cons AS (
 SELECT c.relname||':'||con.conname||':'||con.contype::text||':'||con.convalidated::text||':'||
        con.condeferrable::text||':'||con.condeferred::text||':'||pg_get_constraintdef(con.oid) AS item
 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='rebuild_v2'
   AND NOT (c.relname='apps' AND con.conname='apps_distribution_url_check')
   AND NOT (c.relname='report_attachments' AND con.conname='report_attachments_original_filename_check')
),
idx AS (
 SELECT tbl.relname||':'||ix.relname||':'||pg_get_indexdef(ix.oid)||':'||
        i.indisunique::text||':'||i.indisprimary::text||':'||i.indisvalid::text||':'||
        i.indisready::text||':'||i.indislive::text AS item
 FROM pg_index i JOIN pg_class ix ON ix.oid=i.indexrelid
 JOIN pg_class tbl ON tbl.oid=i.indrelid
 JOIN pg_namespace n ON n.oid=tbl.relnamespace WHERE n.nspname='rebuild_v2'
),
funcs AS (
 SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||
        pg_get_function_result(p.oid)||':'||l.lanname||':'||p.provolatile::text||':'||
        p.prosecdef::text||':'||coalesce(array_to_string(p.proconfig,';'),'')||':'||
        pg_get_userbyid(p.proowner)||':'||pg_get_functiondef(p.oid) AS item
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname IN ('rebuild_v2','rebuild_v2_private')
   AND p.proname NOT IN ('algeria_local_date','get_discoverable_tests_impl','join_test_impl','start_assignment_impl','submit_checkin_impl')
),
pol AS (
 SELECT n.nspname||'.'||c.relname||':'||pol.polname||':'||pol.polcmd::text||':'||
        pol.polpermissive::text||':'||
        (SELECT string_agg(r.rolname,',' ORDER BY r.rolname)
         FROM unnest(pol.polroles) role_oid
         JOIN pg_roles r ON r.oid=role_oid) ||':'||
        coalesce(pg_get_expr(pol.polqual,pol.polrelid),'')||':'||
        coalesce(pg_get_expr(pol.polwithcheck,pol.polrelid),'') AS item
 FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rebuild_v2' OR (n.nspname='storage' AND c.relname='objects' AND right(pol.polname,3)='_v2')
),
trig AS (
 SELECT n.nspname||'.'||c.relname||':'||t.tgname||':'||pg_get_triggerdef(t.oid)||':'||
        t.tgenabled::text||':'||t.tgisinternal::text AS item
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal
   AND (n.nspname='rebuild_v2' OR (n.nspname='auth' AND c.relname='users' AND t.tgname='rebuild_v2_on_auth_user_created'))
),
buck AS (
 SELECT id||':'||name||':'||public::text||':'||coalesce(file_size_limit::text,'')||':'||
        coalesce((SELECT string_agg(mime,',' ORDER BY mime) FROM unnest(allowed_mime_types) AS mime),'') AS item
 FROM storage.buckets
 WHERE id <> 'app-icons'
),
rls AS (
 SELECT n.nspname||'.'||c.relname||':'||c.relrowsecurity::text||':'||c.relforcerowsecurity::text AS item
 FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('rebuild_v2','rebuild_v2_private')
   AND c.relkind IN ('r','p')
),
grants AS (
 SELECT n.nspname||'.'||c.relname||':'||pg_get_userbyid(a.grantee)||':'||
        a.privilege_type||':'||a.is_grantable::text||':'||pg_get_userbyid(a.grantor) AS item
 FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace
 CROSS JOIN LATERAL aclexplode(
   coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))
 ) a
 WHERE n.nspname IN ('rebuild_v2','rebuild_v2_private','storage')
   AND c.relkind IN ('r','p','v','m','S')
 UNION ALL
 SELECT 'schema:'||n.nspname||':'||pg_get_userbyid(a.grantee)||':'||
        a.privilege_type||':'||a.is_grantable::text||':'||pg_get_userbyid(a.grantor) AS item
 FROM pg_namespace n
 CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n'::"char",n.nspowner))) a
 WHERE n.nspname IN ('rebuild_v2','rebuild_v2_private','storage')
 UNION ALL
 SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||
        pg_get_userbyid(a.grantee)||':'||a.privilege_type||':'||
        a.is_grantable::text||':'||pg_get_userbyid(a.grantor) AS item
 FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f'::"char",p.proowner))) a
 WHERE n.nspname IN ('rebuild_v2','rebuild_v2_private')
)
SELECT jsonb_pretty(jsonb_build_object(
 'columns',jsonb_build_object('count',(select count(*) from cols),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from cols),''))),
 'constraints_excluding_equivalent_grouping_deltas',jsonb_build_object('count',(select count(*) from cons),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from cons),''))),
 'indexes',jsonb_build_object('count',(select count(*) from idx),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from idx),''))),
 'functions_excluding_known_date_delta',jsonb_build_object('count',(select count(*) from funcs),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from funcs),''))),
 'v2_policies',jsonb_build_object('count',(select count(*) from pol),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from pol),''))),
 'application_triggers',jsonb_build_object('count',(select count(*) from trig),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from trig),''))),
 'rls_table_flags',jsonb_build_object('count',(select count(*) from rls),'md5',md5(coalesce((select string_agg(item,E'\\n' order by item) from rls),''))),
 'effective_grants',jsonb_build_object('count',(select count(*) from grants),'md5',md5(coalesce((select string_agg(item,E'\\n' order by item) from grants),''))),
 'storage_buckets_excluding_legacy_app_icons',jsonb_build_object('count',(select count(*) from buck),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from buck),''))
))) AS catalog_fingerprint;
