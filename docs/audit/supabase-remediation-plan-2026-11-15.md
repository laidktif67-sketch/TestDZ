# Supabase remediation plan — 2026-11-15

## Scope and safety

This document records a read-only review of the TestDZ Supabase project and the
`feat/developer-create-test-six-step` branch. No schema or data changes have
been applied to the live database as part of this review.

Do not merge this branch, modify `main`, or apply the candidate migrations to a
live project until the checks below have passed. Do not reset either Supabase
project as a shortcut.

## Findings observed during read-only review

1. The database has a `private.cohorts_sync_is_active` function. The trigger
   review found a sync trigger on `public.cohorts`.
2. The database review did not find `private.cohort_tests_validate_is_active_update`,
   the corresponding validation trigger on `public.cohort_tests`, or the
   `cohort_tests_update_developer_recruitment` policy described by
   `20261112231000_cohort_tests_developer_pause_policy.sql`. Re-check before
   treating this as drift; migration history includes renamed/version-shifted
   entries.
3. Supabase Performance Advisor reports nine foreign-key indexing warnings in
   developer-feedback and support-ticket tables. The eight named indexes
   proposed by `20261112232000_index_remaining_foreign_keys.sql` were not
   found under those names during the review. Check equivalent indexes and
   composite-key order before adding any.
4. The database migration ledger and the current feature branch do not match by
   simple filename/version comparison. Filename mismatch alone is not proof a
   migration was never applied.
5. The branch includes account-ban enforcement and suspension/appeal migrations.
   These have broad security effects and must be reviewed and tested separately;
   do not apply them as part of the index/pause-policy remediation.

## Remediation sequence

### Gate A — establish migration/object truth

- Export the complete migration ledger and list all current indexes, foreign
  keys, triggers, policies, and relevant function definitions.
- Match ledger entries to migration files by SQL effects and resulting objects,
  not timestamp or slug alone.
- Record each candidate migration as: applied-equivalent, missing, divergent,
  or not safely determinable.

### Gate B — foreign-key indexes

- Compare every flagged FK's ordered key columns with valid, ready indexes whose
  leading columns cover the FK columns.
- Check existing index definitions and table size before adding an index.
- Prefer a separate, reviewable migration with explicit index names.
- Validate the migration against a disposable PostgreSQL 17/Supabase-compatible
  environment before any hosted application.

### Gate C — recruitment pause policy

- Review the entire candidate migration and related existing RLS policies.
- Test developer ownership, unrelated developer, admin, anonymous, and
  authenticated-but-non-owner cases.
- Test reactivation when a cohort is completed/cancelled and normal updates
  when it is still recruiting.
- Verify the trigger, policy, and function definitions in the target database
  after applying to an isolated test project only.

### Gate D — high-impact account enforcement migrations

- Review `20261113000400_banned_account_enforcement.sql` and
  `20261113000500_admin_account_suspension_appeals.sql` independently.
- Test that banned users cannot write through any public-table or storage path,
  and that admins can appeal/suspend only through intended guarded RPCs.
- Verify no existing service, support, or recovery flow is unintentionally
  blocked.

## Required evidence before considering complete

- A migration-to-schema reconciliation report.
- PostgreSQL 17/Supabase-compatible test output for migrations and RLS cases.
- Before/after definitions for all changed objects.
- No direct live-database mutation until isolated tests pass and a change plan
  is reviewed.
- No claim of runtime success based only on static review or a successful SQL
  inspection.

## Current status

- Read-only review: in progress.
- Live database changes: none.
- Runtime migration/RLS validation: pending.
- Production readiness: not established.
