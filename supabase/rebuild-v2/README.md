# Rebuild v2 candidate scripts

These scripts describe the isolated TestDZ rebuild candidate.

- `001_schema.sql`: candidate tables, indexes, RLS enablement/force.
- `002_security.sql`: private security functions, triggers, policies and grants.
- `003_app_lifecycle.sql`: developer app quota/create/update/archive/restore RPCs with invoker wrappers and private definer implementations.
- `004_identity_sessions.sql`: validated onboarding plus self-only active-session and security-activity RPCs.
- `005_support_notifications.sql`: ticket creation/replies, attachment metadata registration, and owner-scoped notification read-state RPCs.
- `006_storage_policies.sql`: five preserved bucket definitions, owner/participant upload and read policies, and private evidence access helpers.

**Important:** This folder is deliberately not `supabase/migrations`. Do not apply it to production or move it into the active migration path until the validation gates in [the rebuild plan](../../docs/database-rebuild-v2.md) pass.

Apply in order: `001_schema.sql`, `002_security.sql`, `003_app_lifecycle.sql`, `004_identity_sessions.sql`, `005_support_notifications.sql`, and `006_storage_policies.sql`. Run `tests/security_contract.sql` `tests/003_app_lifecycle_contract.sql`, and `tests/004_profile_contract.sql` after all six. The app lifecycle contract validates authenticated developer app create/read/update/archive/restore, quota enforcement, ownership isolation, and app-icon Storage helper authorization. The profile contract validates self-only profile reads/updates and protected verification/ban flags. Both use rolled-back transactions. Validated in TestDZ-FixLab by applying all six scripts to `rebuild_v2` and replaying them into temporary `rebuild_v2_replay` / `rebuild_v2_private_replay` schemas, with replay-only Storage policy names. The Auth signup trigger was omitted only from replay to avoid attaching a second trigger to shared `auth.users`; it remains present in the actual candidate script. Replay schemas and policies were removed after verification.
