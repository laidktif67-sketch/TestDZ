# Rebuild v2 candidate scripts

These scripts describe the isolated TestDZ rebuild candidate.

- `001_schema.sql`: candidate tables, indexes, RLS enablement/force.
- `002_security.sql`: private security functions, triggers, policies and grants.
- `003_app_lifecycle.sql`: developer app quota/create/update/archive/restore RPCs with invoker wrappers and private definer implementations.

**Important:** This folder is deliberately not `supabase/migrations`. Do not apply it to production or move it into the active migration path until the validation gates in [the rebuild plan](../../docs/database-rebuild-v2.md) pass.

Apply in order: `001_schema.sql`, `002_security.sql`, then `003_app_lifecycle.sql`. The security contract test must run after all three. Validated in TestDZ-FixLab by applying to `rebuild_v2` and replaying the schema/security baseline to `rebuild_v2_replay`. The Auth signup trigger was omitted only from the replay schema test to avoid attaching a second test trigger to the same `auth.users` table; it remains present in the actual candidate script.
