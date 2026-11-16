-- Local-only bootstrap: PostgREST requires configured API schemas to exist
-- before the REST service starts. The actual V2 objects are created by the
-- ordered candidate scripts in supabase/rebuild-v2/.
-- This is a local seed, not a migration; never use it to alter hosted schemas.
CREATE SCHEMA IF NOT EXISTS rebuild_v2;
