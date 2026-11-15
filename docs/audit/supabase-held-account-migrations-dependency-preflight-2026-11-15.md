# Held account migrations — deployed dependency preflight (read-only) — 2026-11-15

## Target and safety

Target checked: `TestDZ-Rebuild` (`ouzppgsvwsgtqyabkwjk`) only.
The original `TestDZ` project was not queried or changed.
All queries were read-only. No migrations, data changes, test identities, or Storage objects were created.

## Results

The following prerequisites referenced by `20261113000500_admin_account_suspension_appeals.sql` exist in the rebuild schema:

| Dependency | Result |
|---|---|
| `public.profiles.is_banned` boolean column | Present |
| `public.user_roles.role` | Present |
| `private.is_admin()` | Present |
| Expected `audit_logs` fields (`actor_id`, `action`, `entity_type`, `entity_id`, `before_data`, `after_data`, `metadata`) | All present |
| Expected `notifications` fields (`user_id`, `recipient_role`, `type`, `title`, `body`, `data`, `created_at`) | All present |

The notification table's current `recipient_role` check permits only `tester` and `developer`. The candidate migration's role-selection CASE expressions return one of those values; this dependency appears structurally compatible, but inserts were not attempted.

The `notifications.type` column is plain non-null text. The catalog contains no CHECK constraint enumerating notification types, so a query searching CHECK constraints for `account_suspended` returned false. This is **not itself a failure**: the schema does not enforce a notification-type allowlist at the table constraint level. Application consumers still need review to ensure the new types are handled.

## What this proves — and does not prove

- It proves the listed columns and helper function are present in the isolated rebuild at inspection time.
- It does not prove that the proposed RPCs compile or run after application, that notification triggers/consumers accept the new types, or that RLS/Storage behavior is correct.
- It does not establish compatibility with production or the original `TestDZ` project.
- The two account-enforcement migrations remain unapplied and held.

## Next required checks

1. In a disposable Supabase-compatible target, apply the held migrations only after explicit target verification.
2. Verify all new RPC signatures and grants after application.
3. Test suspension and appeal RPCs with real separate admin, developer, tester, and anonymous identities via PostgREST.
4. Assert audit rows, notification rows, role values, deadline handling, duplicate prevention, atomic rollback, and denial of direct table access.
5. Test Storage upload/download/update/delete as banned and non-banned identities.
6. Review frontend notification handling for `account_suspended`, `account_reinstated`, and `account_appeal_rejected`.

## Current status

- Read-only dependency preflight: completed.
- Runtime/API tests: pending.
- Held migrations applied: no.
- Existing project data/schema changed: no.
- Production readiness: not established.
