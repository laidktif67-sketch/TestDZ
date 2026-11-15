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
3. A live, read-only catalog query compared every public foreign key's ordered
   columns with valid/ready indexes whose leading key columns cover that FK.
   It confirmed nine uncovered foreign keys:
   - `developer_feedback_attachments(message_id)`
   - `developer_feedback_attachments(uploaded_by)`
   - `developer_feedback_events(actor_id)`
   - `developer_feedback_messages(sender_id)`
   - `support_ticket_attachments(ticket_id, message_id)` (composite FK; exact
     column order matters)
   - `support_ticket_attachments(uploaded_by)`
   - `support_ticket_events(actor_id)`
   - `support_ticket_messages(sender_id)`
   - `support_tickets(resolved_by)`

   Existing indexes were enumerated in the same query; none had the required
   leading columns for these nine FKs. This is stronger evidence than checking
   proposed index names alone. It remains a read-only observation, not a
   migration test. The proposed migration contains eight new indexes because
   `developer_feedback_attachments(message_id)` is expected to be covered by
   the existing `developer_feedback_attachments_message_idx`; however, the
   live catalog query did not find that index on this project, so the migration
   and test need reconciliation before use.
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

- Existing `supabase/tests/foreign_key_indexes.test.sql` has nine catalog assertions for the eight indexes plus the previously created message index. These checks validate index presence/definition when run, but no execution result from a PostgreSQL 17/Supabase-compatible test environment has been established in this review.
- The read-only live catalog comparison now confirms all nine flagged FKs lack
  a covering leading-column index in this project.
- Important discrepancy: the branch's earlier conversation migration expects
  a composite `(feedback_id, message_id)` foreign key and creates
  `developer_feedback_attachments_message_idx`; the live catalog instead has
  a single-column `message_id` FK and no matching index. This is schema-shape
  drift and requires migration-ledger/object reconciliation before any DDL.
  Do not treat the nine-index migration as a standalone safe fix until this
  dependency is understood.
- Check table sizes, write overhead, and deployment locking characteristics
  before adding indexes; use `CREATE INDEX CONCURRENTLY` only in a migration
  workflow that supports its transaction restrictions.
- Prefer a separate, reviewable migration with explicit index names.
- Validate the migration against a disposable PostgreSQL 17/Supabase-compatible
  environment before any hosted application.

### Gate C — recruitment pause policy

- Existing `supabase/tests/cohort_campaign_controls.test.sql` has six catalog/privilege assertions. It checks the expected policy and trigger definitions, but it does not itself simulate owner/non-owner updates or exercise the transition behavior against fixture rows. Add behavioral RLS tests before calling this feature runtime-validated.
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
- Live FK/index catalog comparison: completed; nine flagged FKs currently lack
  a covering index in the inspected project.
- Live attachment constraint inspection: completed read-only. The feedback
  attachment table still has independent `feedback_id` and `message_id`
  foreign keys, whereas the branch migration proposes a composite relationship.
  Migration-ledger equivalence remains unresolved.
- Live cohort pause-policy catalog check: the expected update policy and
  validation trigger are absent; only the participants SELECT policy and the
  capacity/key-update triggers were found.
- Live database changes: none.
- Runtime migration/RLS validation: pending.
- Production readiness: not established.
