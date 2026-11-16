# Rebuild v2 candidate scripts

These scripts describe the isolated TestDZ rebuild candidate.

- `001_schema.sql`: candidate tables, indexes, RLS enablement/force.
- `002_security.sql`: private security functions, triggers, policies and grants.
- `003_app_lifecycle.sql`: developer app quota/create/update/archive/restore RPCs with invoker wrappers and private definer implementations.
- `004_identity_sessions.sql`: validated onboarding plus self-only active-session and security-activity RPCs.
- `005_support_notifications.sql`: ticket creation/replies, attachment metadata registration, and owner-scoped notification read-state RPCs.
- `006_storage_policies.sql`: five preserved bucket definitions, owner/participant upload and read policies, and private evidence access helpers.
- `007_tester_workflow.sql`: tester discovery, joining, assignments, check-ins, feedback, submissions, and private evidence workflow.
- `008_developer_lifecycle.sql`: app submission/admin review, test create/update/submission/admin review, and developer cohort creation RPCs.
- `009_lock_app_edits_during_review.sql`: blocks developer edits while an app is pending review or published; edits are limited to draft/rejected states.
- `010_guard_test_cohort_capacity.sql`: requires a published parent app and cohort capacity at least equal to the test's minimum tester target.
- `011_test_content_authoring.sql`: owner-checked atomic save of ordered test steps and requirements, editable only while the test is draft/failed/cancelled; no direct browser table writes.
- `012_cohort_management.sql`: owner-only forming-cohort edits and audited lifecycle transitions; pending assignments are withdrawn on safe cancellation, and cohort readiness requires the test's minimum tester count.

**Important:** This folder is deliberately not `supabase/migrations`. Do not apply it to production or move it into the active migration path until the validation gates in [the rebuild plan](../../docs/database-rebuild-v2.md) pass.

Apply in order: `001_schema.sql`, `002_security.sql`, `003_app_lifecycle.sql`, `004_identity_sessions.sql`, `005_support_notifications.sql`, and `006_storage_policies.sql`, then `007_tester_workflow.sql`, `008_developer_lifecycle.sql`, `009_lock_app_edits_during_review.sql`, `010_guard_test_cohort_capacity.sql`, `011_test_content_authoring.sql`, and `012_cohort_management.sql`. Run `tests/security_contract.sql`, `tests/003_app_lifecycle_contract.sql`, `tests/004_profile_contract.sql`, and `tests/005_developer_lifecycle_contract.sql` after all scripts. The developer lifecycle contract also verifies non-owner denial, malformed content rejection, content lock after submission, audit logging, and rollback cleanup for test steps and requirements. The app lifecycle contract validates authenticated developer app create/read/update/archive/restore, quota enforcement, ownership isolation, and app-icon Storage helper authorization. The profile contract validates self-only profile reads/updates and protected verification/ban flags. All use rolled-back transactions. The developer lifecycle contract validates app submission and admin-only approval, test creation/submission and admin-only approval, test content authoring, cohort creation/update/cancellation, minimum tester readiness, tester join, and audit-event creation. Validated in TestDZ-FixLab by applying candidate scripts through `010_guard_test_cohort_capacity.sql` to `rebuild_v2` and replaying them into temporary `rebuild_v2_replay` / `rebuild_v2_private_replay` schemas, with replay-only Storage policy names. The Auth signup trigger was omitted only from replay to avoid attaching a second trigger to shared `auth.users`; it remains present in the actual candidate script. Replay schemas and policies were removed after verification.
