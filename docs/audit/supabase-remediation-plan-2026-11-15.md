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

Static source review was performed for both candidate migrations; this is not a
runtime or security sign-off.

- `20261113000400_banned_account_enforcement.sql` installs a restrictive
  policy and write-blocking trigger on every public table except the special
  profile path, plus a restrictive storage policy. Because this has broad
  effects, validate each public-table RLS policy combination and all legitimate
  storage upload/delete flows with banned and non-banned identities before
  applying it.
- `20261113000500_admin_account_suspension_appeals.sql` creates suspension
  and appeal tables with direct table access revoked and exposes guarded RPCs.
  Its procedures depend on existing `profiles.is_banned`, `user_roles`,
  `audit_logs`, and `notifications` schemas/constraints. Confirm those
  exact deployed definitions and test notification inserts for each role before
  applying.
- Required behavioral cases: non-admin cannot suspend or review; admin cannot
  suspend self or another admin; invalid/duplicate suspension is rejected;
  suspended user can read only their suspension and submit one appeal inside
  the seven-day window; expired/duplicate appeals fail; non-admin cannot list
  appeals; accepted appeal lifts suspension atomically; rejected appeal keeps
  suspension active; every admin decision is audited and notifications satisfy
  deployed constraints; banned user cannot bypass enforcement via RPC or
  Storage.
- Verify no existing service, support, or recovery flow is unintentionally
  blocked. These cases are not yet run against an isolated Supabase-compatible
  environment.

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
- A further read-only privileges/RLS query found only SELECT grants to
  `authenticated` on `public.cohort_tests` and `public.cohorts`, and only
  the participants SELECT policies on those tables. The intended pause feature
  is therefore not currently exposed through the expected authenticated
  column-level UPDATE grant/policy in this inspected project. This confirms a
  functional gap for that feature, but the missing objects still must be
  reconciled against the migration ledger and deployed schema history before
  applying a repair.
- Live database changes: none.
- Runtime migration/RLS validation: pending.
- Production readiness: not established.


## Follow-up reconciliation evidence (read-only, 2026-11-15)

The latest Supabase migration ledger query returned **42 recorded entries**. The
latest feature branch tree contains **52 migration files**. The ledger's newest
entries are `app_distribution_schema_and_rpc`,
`align_app_distribution_method`, `test_type_and_config`, and
`allow_test_drafts` (versions `20261114222735` through
`20261114222935`). This confirms the count/version mismatch remains; it does
not by itself establish that every unlisted file is unapplied because deployed
migration names may have been renamed.

A second read-only catalog query confirmed:
- `public.support_tickets`, `public.support_ticket_messages`,
  `public.support_ticket_attachments`, and developer-feedback conversation
  tables exist. The live support attachment relation is the composite FK
  `(ticket_id, message_id) -> support_ticket_messages(ticket_id, id)`.
- `developer_feedback_attachments` still has separate foreign keys for
  `feedback_id` and `message_id`, rather than the composite feedback/message
  relationship proposed by one branch migration.
- None of the candidate FK index names checked by the query were present,
  including `developer_feedback_attachments_message_idx` and the eight names
  from `20261112232000_index_remaining_foreign_keys.sql`.
- The expected pause-policy validation trigger is still absent; only
  `cohorts.trg_cohorts_sync_is_active` matched the cohort-active trigger check.
- Neither `public.account_suspensions` nor
  `public.account_suspension_appeals` exists in the inspected live project.
  Therefore the account suspension/appeals migration is not reflected by
  those expected tables in this database. Do not infer safety to apply it:
  its dependencies and complete RPC/policy behavior still need isolated tests.

### Updated decision

Do **not** apply the candidate migrations to the live project. The most
actionable next step is to build a disposable PostgreSQL 17/Supabase-compatible
test target and reconcile migration history against object definitions there.
The available local PostgreSQL database is not Supabase-compatible, and the
current hosted projects have not been confirmed as disposable. The absence of
the suspension tables and candidate indexes is recorded as schema drift evidence,
not as authorization for a live repair.


## Data preflight for attachment relationship (read-only)

A targeted read-only query against the inspected TestDZ project returned:
- `developer_feedback_attachments` row count: **0**
- rows whose `message_id` has no matching developer feedback message: **0**
- rows where attachment `feedback_id` differs from its message's `feedback_id`: **0**
- rows with null `message_id`: **0**
- support-ticket attachments without a matching `(ticket_id, message_id)` message: **0**

This means the current data set does not reveal a row-level blocker to validating the proposed composite developer-feedback attachment relationship. However, the developer-feedback attachment table is empty, so the query does **not** prove that the relationship or migration works with real rows, nor does it justify applying the migration to the live database. The candidate migration also changes constraints and policies, and still requires a disposable Supabase-compatible test run.

### Current priority ordering

1. Obtain an isolated Supabase-compatible PostgreSQL 17 test target; neither connected hosted project has been confirmed disposable.
2. Reconcile the recorded migration ledger with the deployed objects, including the feedback-attachment relationship and candidate index set.
3. Run the existing pgTAP tests plus behavioral tests using fixture rows and separate owner/non-owner/admin identities.
4. Only after the test results and schema diff are reviewed, prepare a narrowly scoped change plan for a separately approved deployment window.
