# Focused security review: held account-enforcement migrations — 2026-11-15

## Scope and safety

Read-only source review of the following files on `feat/developer-create-test-six-step` and read-only catalog checks against `TestDZ-Rebuild` (`ouzppgsvwsgtqyabkwjk`):

- `supabase/migrations/20261113000400_banned_account_enforcement.sql`
- `supabase/migrations/20261113000500_admin_account_suspension_appeals.sql`

No migration was applied, no database objects or data were changed, and no Auth identities or Storage objects were created. The original `TestDZ` project was not queried or modified in this review.

## Findings

### 1. The six current SECURITY DEFINER warnings remain intentionally unresolved

The rebuild catalog confirms these functions are owned by `postgres`, have `search_path = ''`, and grant EXECUTE to `authenticated` and `service_role`:

- `public.add_cohort_test(uuid, uuid)`
- `public.create_app_with_distribution(text, text, text, text, text)`
- `public.create_cohort(text, integer, uuid[])`
- `public.get_my_active_sessions()`
- `public.get_my_security_activity(integer)`
- `public.remove_cohort_test(uuid, uuid)`

The three cohort functions have admin guards in their inspected definitions; the app function has authentication/ownership checks; the two self-service functions filter to the caller. These are static observations only. Keep the advisor warnings open until identity-based HTTP/RPC tests verify the positive and negative cases. Do not revoke authenticated EXECUTE indiscriminately: that could break intended application flows.

Advisor remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

### 2. Banned-account migration has a broad, time-of-application scope

The migration dynamically adds a restrictive policy and a write-blocking trigger to every `public` ordinary/partitioned table that exists at the time it runs (with a special policy/trigger path for `profiles`), and adds a restrictive policy to `storage.objects`.

This is intentionally high impact. The dynamic loop is a one-time migration, not an automatic guard for tables created later. A future public table would not inherit this policy/trigger unless another migration adds it. Any rollout therefore needs:
- a post-migration catalog assertion that enumerates every relevant table and confirms expected policy/trigger coverage;
- a forward-compatibility check for tables created after this migration;
- banned/non-banned HTTP tests across every feature area and Storage bucket.

Do not apply this migration to either existing project until the behavior is exercised in a disposable Supabase-compatible target.

### 3. Suspension/appeal tables are designed for RPC-only access

The candidate migration enables RLS on `account_suspensions` and `account_suspension_appeals`, revokes direct table privileges from `public`, `anon`, and `authenticated`, and exposes guarded SECURITY DEFINER RPCs. It uses profile ban state, admin roles, audit logs, and notifications, so those dependencies and notification constraints must be verified against the exact target schema.

Static review points requiring tests:
- non-admin calls to each admin RPC are rejected;
- admins cannot suspend themselves or another admin;
- suspension creation, `profiles.is_banned`, audit row, and notification are atomic;
- a banned user can read only their own suspension state and submit exactly one appeal within the deadline;
- duplicate/expired appeals are rejected;
- appeal acceptance lifts the ban and suspension atomically; rejection keeps the ban;
- notification role selection and required columns satisfy the deployed schema;
- direct table reads/writes remain denied.

The appeal submission RPC intentionally does not write audit logs or notifications because the submitter is banned; review actions are audited and notified by the admin review RPC. Confirm this behavior matches product requirements.

### 4. Current rebuild cannot prove these migrations work

The two candidate tables do not exist in `TestDZ-Rebuild`, as expected while the migrations remain held. A catalog query of current objects therefore cannot validate their RLS, triggers, grants, or RPC behavior. No conclusion of runtime success or security sign-off is warranted.

### 5. Storage policies are still only statically inspected

The current rebuild has 12 policies on `storage.objects`. The owner-folder checks for avatars/app icons and participant checks for support/developer-feedback attachments were inspected in the catalog. This is not proof of real upload, download, update, or delete behavior. The proposed restrictive banned-account policy must be tested against each legitimate flow using separate signed-in identities and actual Storage HTTP calls.

## Required next gate

1. Prepare a disposable Supabase-compatible test target; do not treat either connected project as disposable without explicit confirmation.
2. Apply the two held migrations only in that disposable target.
3. Use temporary Auth identities with a documented cleanup path, fixture rows with rollback/cleanup, and actual PostgREST/Storage HTTP requests.
4. Assert both allowed and denied outcomes, including no unauthorized row/object changes.
5. Re-run catalog checks and all relevant tests after the migrations.
6. Keep the migrations held until evidence is reviewed.

## Status

- Source review: completed for this focused pass.
- Rebuild catalog checks: completed read-only; no schema changes.
- Auth/RLS/Storage behavioral tests: pending.
- Held migrations applied: no.
- Old project modified: no.
- Merge, production deployment, or GitHub Actions run: none.
- Production readiness: not established.
