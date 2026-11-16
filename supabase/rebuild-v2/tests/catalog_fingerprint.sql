-- Read-only fingerprint of the final V2 catalog.
-- Run after candidate scripts 001..018. Excludes the two known live/candidate date-delta functions:
-- algeria_local_date (candidate-only) and submit_checkin_impl (intentionally patched only in candidate).
-- Compare this output with the same query on FixLab before any hosted baseline or patch operation.

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
),
cons AS (
 SELECT c.relname||':'||con.conname||':'||con.contype::text||':'||con.convalidated::text||':'||
        con.condeferrable::text||':'||con.condeferred::text||':'||pg_get_constraintdef(con.oid) AS item
 FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rebuild_v2'
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
   AND p.proname NOT IN ('algeria_local_date','submit_checkin_impl')
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
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('rebuild_v2','storage')
),
trig AS (
 SELECT n.nspname||'.'||c.relname||':'||t.tgname||':'||pg_get_triggerdef(t.oid)||':'||
        t.tgenabled::text||':'||t.tgisinternal::text AS item
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND n.nspname IN ('auth','rebuild_v2')
),
buck AS (
 SELECT id||':'||name||':'||public::text||':'||coalesce(file_size_limit::text,'')||':'||
        coalesce(array_to_string(allowed_mime_types,','),'') AS item
 FROM storage.buckets
)
SELECT jsonb_pretty(jsonb_build_object(
 'columns',jsonb_build_object('count',(select count(*) from cols),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from cols),''))),
 'constraints',jsonb_build_object('count',(select count(*) from cons),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from cons),''))),
 'indexes',jsonb_build_object('count',(select count(*) from idx),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from idx),''))),
 'functions_excluding_known_date_delta',jsonb_build_object('count',(select count(*) from funcs),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from funcs),''))),
 'policies',jsonb_build_object('count',(select count(*) from pol),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from pol),''))),
 'application_triggers',jsonb_build_object('count',(select count(*) from trig),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from trig),''))),
 'storage_buckets',jsonb_build_object('count',(select count(*) from buck),'md5',md5(coalesce((select string_agg(item,E'\n' order by item) from buck),''))
))) AS catalog_fingerprint;
