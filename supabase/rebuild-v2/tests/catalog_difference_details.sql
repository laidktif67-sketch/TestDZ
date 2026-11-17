-- Read-only drill-down for catalog classes whose fingerprints differ from FixLab.
WITH cons AS (
 SELECT c.relname AS object_name,
        con.conname||':'||con.contype::text||':'||con.convalidated::text||':'||
        con.condeferrable::text||':'||con.condeferred::text||':'||pg_get_constraintdef(con.oid) AS item
 FROM pg_constraint con
 JOIN pg_class c ON c.oid=con.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='rebuild_v2'
),
pol AS (
 SELECT n.nspname||'.'||c.relname AS object_name,
        pol.polname||':'||pol.polcmd::text||':'||pol.polpermissive::text||':'||
        (SELECT string_agg(r.rolname,',' ORDER BY r.rolname)
         FROM unnest(pol.polroles) role_oid JOIN pg_roles r ON r.oid=role_oid)||':'||
        coalesce(pg_get_expr(pol.polqual,pol.polrelid),'')||':'||
        coalesce(pg_get_expr(pol.polwithcheck,pol.polrelid),'') AS item
 FROM pg_policy pol
 JOIN pg_class c ON c.oid=pol.polrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='rebuild_v2' OR (n.nspname='storage' AND c.relname='objects')
),
groups AS (
 SELECT 'constraint' AS kind,object_name,count(*) AS item_count,
        md5(string_agg(item,E'\n' ORDER BY item)) AS fingerprint
 FROM cons GROUP BY object_name
 UNION ALL
 SELECT 'policy',object_name,count(*),md5(string_agg(item,E'\n' ORDER BY item))
 FROM pol GROUP BY object_name
)
SELECT jsonb_pretty(jsonb_build_object(
 'objects',(SELECT jsonb_agg(jsonb_build_object('kind',kind,'object',object_name,'count',item_count,'md5',fingerprint) ORDER BY kind,object_name) FROM groups),
 'buckets',(SELECT jsonb_agg(id||':'||name||':'||public::text||':'||coalesce(file_size_limit::text,'')||':'||
        coalesce((SELECT string_agg(mime,',' ORDER BY mime) FROM unnest(allowed_mime_types) AS mime),'') ORDER BY id)
        FROM storage.buckets)
)) AS catalog_difference_details;