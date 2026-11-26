# TestDZ Production-to-Rebuild V2 audit

Audit date: 2026-11-26  
Official application reference: `rebuild/testdz-v2`  
Official commit at audit start: `9aa553126cfd553fc78534e62c1fa2122965d5d2`  
Hosted Supabase project: TestDZ (`naqjjykcglxiobkmdllj`), `eu-west-3`, PostgreSQL 17.11  
Mode: read-only inventory. No production schema, data, migration history, Auth settings, Storage objects, or Edge Functions were changed.

## Executive decision

The Rebuild V2 candidate is the approved application architecture, but the hosted TestDZ database is still the legacy `public` schema. Do not apply the candidate scripts to the hosted project yet.

The 34 scripts in `supabase/rebuild-v2/` are explicitly candidate-only. The final-state contract expects 48 tables, RLS + FORCE RLS on all 48, policy coverage on 47, and seven Storage buckets. The README and final-state contract are the current candidate references; older prose in `docs/database-rebuild-v2.md` still mentions an earlier 18-script / 47-table state and must be treated as historical/stale.

## Hosted database inventory

Observed through Supabase read-only APIs and SQL on 2026-11-26:

- Project status: ACTIVE_HEALTHY; PostgreSQL 17.11; region eu-west-3.
- Schemas containing application tables: `public` (42 tables) and `supabase_migrations` (history table). Neither `rebuild_v2` nor `rebuild_v2_private` exists in this hosted project.
- Auth users: 2; public profiles: 2; user_roles: 3.
- Role distribution: admin 1, developer 1, tester 1. There is no existing Financial or Support role assignment.
- Wallets: 2; aggregate earned points = 0; aggregate purchased credits = 0; legacy points_ledger rows = 0.
- Plans: 3 active plans (Free, Plus, Pro).
- platform_config: 15 keys. Preserve the keys and their values through an explicit mapping; do not silently replace with candidate defaults.
- Applications/tests/cohorts/assignments/check-ins/feedback/payments/subscriptions/refunds/reports/disputes/notifications/support tickets and conversation records were observed at zero rows in the queried tables.
- All five existing Storage buckets were observed with zero objects: `app-icons` (public), `avatars` (public), `developer-feedback-attachments` (private), `support-attachments` (private), `test-evidence` (private).

The zero-row observations are point-in-time inventory results, not a promise that no new data will arrive. Recheck immediately before any cutover.

## Migration-history reconciliation

The hosted project reports 43 applied migration records. The official Git branch contains 31 files under `supabase/migrations/`.

A normalized filename/name comparison found:
- 29 applied records with a matching repository migration name.
- 14 applied records without a matching filename in the current active migration directory.
- 2 repository migration files without an applied record matching their filename:
  - `20261110193000_onboarding_profile_row_guard.sql`
  - `20261111000400_support_tickets.sql`

This comparison is provenance evidence only. It does not prove SQL-body equivalence, nor does it authorize editing the hosted migration ledger. Several hosted names correspond conceptually to changes now represented in the V2 candidate scripts, but those relationships need a reviewed, explicit mapping.

Unmatched applied history names requiring source recovery/provenance mapping:
- `test_details_and_medical_exceptions`
- `developer_feedback_reviews`
- `developer_notification_archive`
- `separate_notification_recipient_roles`
- `separate_support_ticket_requester_roles`
- `support_ticket_priority_activity`
- `audit_support_ticket_priority_changes`
- `developer_feedback_conversation_and_priority`
- `developer_feedback_details_conversations_attachments_events`
- `app_distribution_schema_and_rpc`
- `align_app_distribution_method`
- `test_type_and_config`
- `allow_test_drafts`
- `reconcile_assignments_cohort_foreign_keys`

The Supabase migration-list API provides version/name records, not the original SQL bodies. Recover those SQL definitions from Git history, historical PR refs, or a trusted backup before claiming a complete migration archive. Never reset or rewrite `supabase_migrations.schema_migrations` just to align counts.

## Initial data mapping decisions

| Legacy public data | Rebuild V2 target | Current observation / rule |
|---|---|---|
| `profiles` | `rebuild_v2.profiles` | 2 rows. Preserve identity/profile fields. Legacy `subscription_tier` is not a canonical V2 profile field; derive subscription state from the canonical plan/subscription relation. |
| `user_roles` | `rebuild_v2.user_roles` | 3 assignments: admin, developer, tester. Preserve exactly; do not auto-grant Financial or Support. |
| `wallets` | `rebuild_v2.wallets` | 2 rows; both aggregate balances are zero. Preserve the wallet rows and verify per-user balance equality. |
| `points_ledger` | `rebuild_v2.wallet_ledger` | 0 legacy rows observed. Keep earned points and purchased credits as separate ledger types; never synthesize ledger entries from balance fields. |
| `plans` / `subscriptions` | V2 plan/subscription model | 3 active plans, 0 subscription rows. Preserve plan semantics and identifiers through an explicit mapping. |
| `platform_config` | `rebuild_v2.platform_config` | 15 keys. Preserve and review values individually; feature flags and payment/referral/trial switches must not be activated accidentally. |
| `audit_logs` | `rebuild_v2.audit_events` | 0 rows observed. Keep append-only audit semantics; map event vocabulary deliberately. |
| `notifications` | `rebuild_v2.notifications` | 0 rows observed. Candidate migration 019's non-empty-table guard is expected to pass only if the table is still empty at cutover time. |
| Support / developer feedback tables | V2 support and feedback tables | 0 rows observed. Verify metadata and private-attachment semantics before moving bucket policies. |
| Existing Storage buckets | V2 seven-bucket layout | Five current buckets are empty. Preserve bucket identity/configuration until V2 paths and signed access are verified; do not delete or make private/public as a shortcut. |

## Security and performance observations

- RLS is enabled on all 42 public application tables; no public table without an RLS policy was found in the catalog query.
- Supabase Security Advisor reports six authenticated-callable SECURITY DEFINER functions. The reviewed definitions set an empty search_path and contain explicit authorization/ownership checks. These findings require function-by-function review, but are not by themselves proof of an exploitable vulnerability.
- Leaked-password protection is disabled. Enabling it is recommended, but it is an Auth behavior change and must be tested against sign-in/sign-up flows before enabling.
- Performance Advisor reports nine unindexed foreign keys, three tables with multiple permissive SELECT policies, and 33 unused indexes. Do not drop unused indexes based on low-traffic statistics. Decide whether to fix legacy indexes only if the legacy schema will remain active during the transition; candidate V2 has its own index set.

## Required work before hosted cutover

1. Recover the original SQL bodies/provenance for all 14 unmatched applied history entries; map each to a specific V2 script or explicitly mark it retired with evidence.
2. Explain the two checked-in-but-unmatched migration files; verify whether their effects are already present in the live catalog and whether the V2 candidate supersedes them.
3. Produce a column/constraint/index/trigger/function/grant/RLS/Storage mapping from the current `public` catalog to the final 48-table V2 catalog.
4. Explicitly map the 15 `platform_config` keys and the three plans. Keep payment, referral, trial, reward, and withdrawal behavior disabled unless separately approved.
5. Verify the two Auth users, their exact role sets, two wallet rows, and profile mappings in a non-production rehearsal. Do not copy Auth passwords or secrets into a data migration.
6. Rehearse V2 candidate replay and PostgREST exposure on an isolated Supabase branch or disposable database. Creating a Supabase branch may incur cost and requires cost confirmation.
7. Verify backup restoration and rollback. A backup's existence is insufficient; prove it can be restored.
8. Complete route/API compatibility and production build gates. The current application must not be switched to V2 merely because the schema exists.
9. Obtain a final, explicit cutover approval before applying any V2 DDL, data movement, migration-history operation, Auth setting change, Storage policy change, Edge Function deployment, or Vercel deployment.

## Changes performed

- Read-only catalog, row-count, migration-history, Storage inventory, and Advisor queries only.
- No production database writes or DDL.
- No migration history repair.
- No Supabase Auth settings changes.
- No Storage object/policy changes.
- No Edge Function or cron deployment.
- No Vercel deployment.


## Historical migration source recovery — follow-up on 2026-11-26

A search of retained historical branch refs recovered SQL sources for 13 of the 14 applied records that do not have a matching file in the current active migration directory. These are provenance matches only; the source files are not being reintroduced into the active migration path, and their bodies have not been proven byte-for-byte identical to the hosted execution.

Useful retained source refs:
- `audit/supabase-remediation-plan` at `fa23deb0faa6f67735d56c2e3fba075c59922624`
- `feat/test-details-medical-exceptions` at `bc737fee2fb41593b10dc8854775fec655e131dc`

Recovered source mappings:
- `test_details_and_medical_exceptions` → `20261110114224_test_details_and_medical_exceptions.sql` on `feat/test-details-medical-exceptions`.
- `developer_feedback_reviews` → `20261112184901_developer_feedback_reviews.sql`.
- `developer_notification_archive` → `20261112200100_developer_notification_archive.sql`.
- `separate_notification_recipient_roles` → `20261112191021_separate_notification_recipient_roles.sql`.
- `separate_support_ticket_requester_roles` → `20261112224000_support_ticket_requester_role.sql` and `20261112225000_support_ticket_requester_role_policy.sql`.
- `support_ticket_priority_activity` / `audit_support_ticket_priority_changes` → priority grant and audit-forward sources `20261113000100_support_ticket_priority_grant.sql` and `20261113000200_support_ticket_priority_audit_forward.sql`. Exact one-to-one mapping between the two hosted names and the two source files remains to be verified.
- `developer_feedback_conversation_and_priority` → `20261112213000_developer_feedback_review_priority.sql`, `20261112220000_developer_feedback_conversations.sql`, and `20261112223000_developer_feedback_review_priority_grant.sql`.
- `developer_feedback_details_conversations_attachments_events` → conversation/attachment/event source `20261112220000_developer_feedback_conversations.sql`, with later audit hardening in `20261112230000_developer_feedback_audit_integrity.sql`.
- `app_distribution_schema_and_rpc` → `20261114222735_app_distribution_schema_and_rpc.sql`.
- `align_app_distribution_method` → `20261114222820_align_app_distribution_method.sql`.
- `test_type_and_config` → `20261114222912_test_type_and_config.sql`.
- `allow_test_drafts` → `20261114222935_allow_test_drafts.sql`.

Still unrecovered from the checked historical refs:
- `reconcile_assignments_cohort_foreign_keys` (hosted version `20261115092608`). Its effect must be established from the current catalog and candidate constraints, but do not invent or reconstruct an original migration body from its name.

### Additional historical Git lead for the unrecovered cohort-FK migration

A search of the repository's historical pull requests found PR #36, still Draft and unmerged, on the legacy branch `fix/week-5-fk-reconciliation`. It adds `supabase/migrations/20261115000100_reconcile_assignments_cohort_foreign_keys.sql`:

- The file's initial commit is `4806ccebf9016fc9b009f1f12d4bbe0b5844bc53` (2026-11-15 08:54:41 UTC), followed by hardening commit `4e1efa4dc6e3aeec3a43c6618be707f01df4b41e` (08:54:52 UTC).
- Its SQL conditionally removes `assignments_cohort_tester_fk` only if its exact definition is `(cohort_id,tester_id) -> cohort_tests(cohort_id,developer_id)`; it validates or creates `(cohort_id,test_id) -> cohort_tests(cohort_id,test_id) ON DELETE RESTRICT`, failing closed on unexpected definitions or orphan rows.
- Its regression script explicitly refuses non-local database URLs. PR #36's description says it was not applied to either Supabase project and still required isolated replay. The PR's associated GitHub Actions run `43696710292` is recorded as **failed** across all four jobs; the job-log archive currently returns BlobNotFound, so the failure causes cannot be independently established from those logs. This candidate migration therefore has no verified passing replay evidence in that PR.
- This is a strong *candidate lead* because the migration slug matches the hosted history name and the current catalog lacks the invalid FK while retaining the correct composite FK. It is **not** proof that this exact SQL was applied as hosted version `20261115092608`: the candidate file's version is `20261115000100`, the timestamps differ, PR #36 is Draft/unmerged, and the live catalog also contains additional separate CASCADE/RESTRICT relationships not explained by this file alone.

Therefore keep `20261115092608` classified as **exact hosted SQL body unrecovered**. Use PR #36 only as a provenance lead for effect mapping; do not copy its migration into the V2 active path, mark the hosted version recovered, or apply it to production.

The two files present in the historical migration branch but absent from the current active path also have source available:
- `20261110193000_onboarding_profile_row_guard.sql`
- `20261111000400_support_tickets.sql`

Their effects and relationship to later applied changes still need catalog-level confirmation. In particular, the current project has support ticket tables, but the hosted migration history does not expose a matching migration name for the standalone support-ticket base migration.

### Updated next gate

Recover or conclusively account for the single remaining migration source (`20261115092608`), then perform a catalog-level effect mapping for all recovered historical files. A recovered filename alone is not evidence that the hosted database ran exactly that SQL or that its final effects are all present in V2.


### Additional configuration values verified

A second read-only query confirmed:
- Both legacy profiles currently have `subscription_tier = 'free'`.
- `payments.enabled = false`.
- `referral.enabled = false`.
- `trial.enabled = false`.
- `fraud.auto_suspend = false`.
- `cohort.auto_form = true`.

The last value is important: do not blindly copy it into a V2 setting or assume it means the same workflow. Confirm the candidate's intended cohort lifecycle before mapping it. The disabled payment/referral/trial/fraud switches must remain disabled through any migration rehearsal and cutover unless separately approved.


## Cohort/assignment foreign-key reconciliation detail

The remaining hosted history name `reconcile_assignments_cohort_foreign_keys` has not been recovered as an original SQL file from the historical refs inspected so far. A catalog comparison does show a concrete relationship difference that must be reviewed:

- Live `public.assignments` has separate `cohort_id → cohorts(id) ON DELETE CASCADE` and `test_id → tests(id) ON DELETE CASCADE` foreign keys, plus a composite `(cohort_id,test_id) → cohort_tests(cohort_id,test_id) ON DELETE RESTRICT` foreign key.
- Live `public.cohort_tests` has `cohort_id → cohorts(id) ON DELETE RESTRICT`, `developer_id → profiles(id) ON DELETE RESTRICT`, a composite `(test_id,developer_id) → tests(id,developer_id)` reference, and a separate `test_id → tests(id) ON DELETE RESTRICT` reference.
- V2 baseline `001_schema.sql` instead models `assignments` through the composite `(cohort_id,test_id) → cohort_tests` RESTRICT reference, and `cohort_tests` through the composite `(test_id,developer_id) → tests(id,developer_id)` RESTRICT reference plus the cohort reference. This makes the cohort/test ownership relationship explicit and avoids relying on the legacy single-column cascade edges.

The candidate captures a coherent target relationship, but this is not proof of what the unrecovered hosted migration did. Before cutover, validate that no legacy row violates the composite ownership relationship (current row counts for both tables are zero), then verify the final candidate constraints and negative delete behavior in the isolated replay. Do not remove or alter live foreign keys now merely because the V2 baseline differs.




### Application integration check for the V2 cohort model

A targeted read-only check of the official branch's application entry points confirms the main developer/tester paths are wired to the V2 API names:

- `apps/web/src/modules/developer/pages/DeveloperTestsPage.tsx` calls the developer cohort API for create, edit and status transitions. `apps/web/src/features/apps/apps-api.ts` maps these to `create_test_cohort`, `update_test_cohort`, and `transition_test_cohort`; cohort listing reads `cohort_tests` joined to `cohorts` and filters by developer ownership.
- `apps/web/src/features/tester/dashboard-api.ts` reads `get_discoverable_tests`; `apps/web/src/features/tester/test-preview-api.ts` maps joining to `join_test`; `apps/web/src/features/tester/assignments-api.ts` maps start/check-in/final submission to `start_assignment`, `submit_checkin`, `create_assignment_submission`, `register_assignment_submission_attachment`, and `finalize_assignment_submission`.
- `apps/web/src/lib/supabase-data.ts` centralizes table/RPC routing: it selects schema `rebuild_v2` only when `VITE_TESTER_WORKFLOW_V2_ENABLED === "true"`; otherwise it returns the legacy public client. `apps/web/src/lib/supabase-v2.ts` explicitly says to keep the flag disabled in Production until the V2 cutover is approved. Auth and Storage remain on the base client.

This supports the conclusion that the checked developer/tester cohort workflows are intentionally V2-shaped and that production remains behind an explicit feature flag. It is a targeted integration check, not a complete route-by-route certification: remaining developer/admin/support routes and any indirect RPC callers still need a full pre-cutover inventory. Do not enable the flag before the hosted V2 schemas and all prerequisites are deployed and separately approved.


## Legacy cohort RPCs versus Rebuild V2 product model — 2026-11-26

A direct source comparison was completed between legacy `20261108000100_cohort_rpcs.sql` / `20261109203006_restrict_report_assignment_deletion.sql` (historical branch `feat/tester-assignment-report-submission`) and V2 `008_developer_lifecycle.sql`, `010_guard_test_cohort_capacity.sql`, `012_cohort_management.sql`, and `007_tester_workflow.sql` on the official Rebuild V2 branch.

| Area | Legacy RPC model | Rebuild V2 candidate |
|---|---|---|
| Cohort creation | Admin-only `create_cohort`; exactly 13 tests from 13 distinct developers, capacity 13, and 156 cross-developer assignments created atomically | Developer/admin creates a cohort for one owned recruiting/ready test and published app; capacity 1–500 but not below the test minimum; one cohort_tests membership is created |
| Joining | Admin's cohort-creation/add-test operations prebuild the tester assignment matrix | A tester with tester role calls `join_test`; V2 locks capacity, creates one pending assignment, and returns an existing pending/active assignment idempotently |
| Add/remove cohort tests | Admin-only `add_cohort_test` expands the round-robin matrix; `remove_cohort_test` removes a test only from a forming cohort and only if all affected assignments have no feedback, check-ins, play-opt-in events, non-pending status, or (after the report-hardening migration) reports | No equivalent add/remove cohort-test RPC is present in the inspected V2 candidate. Cohort editing changes metadata/capacity while forming; lifecycle transition is handled separately |
| Cancellation | Legacy status triggers allow forming/ready/running → cancelled; membership removal is a separate forming-only operation with guarded deletion | V2 cancellation is allowed from forming/ready only, rejects if any assignment is active, withdraws pending assignments, then marks the cohort cancelled; it does not delete assignments or cohort_tests membership |
| Retention | Legacy adds `reports.assignment_id → assignments.id ON DELETE RESTRICT` and explicit `HAS_REPORTS` rejection in `remove_cohort_test` | V2 keeps assignment→cohort_tests and report→assignment RESTRICT FKs; cancellation retains assignment rows and changes pending rows to withdrawn |

This is a material business-model/API change, not a mechanical schema translation: the legacy 13-developer round-robin cohort is replaced by a developer-owned, single-test cohort filled by tester opt-ins. The V2 implementation has explicit ownership, tester-role, capacity, lifecycle and retention controls, but the product owner must confirm that the new one-test cohort model intentionally supersedes the legacy 13-test matrix and that no user-facing feature still promises add/remove cohort membership.

**Follow-up status:** the primary developer/tester cohort paths have now been traced to the V2 API names and the central feature-flag selector (details above). A complete route-by-route inventory of remaining modules and indirect RPC callers is still required before cutover. No hosted functions, FKs, data, or feature flags were changed during this comparison.

## Cohort/assignment follow-up — 2026-11-26 (read-only)

The historical source comparison adds an important detail to the unrecovered migration investigation:

- The retained 20261107000200_assignments_feedback_constraints.sql source (present on feat/tester-assignment-report-submission and test/developer-cohort-transition-contract) creates two composite foreign keys on assignments: (cohort_id,test_id) to cohort_tests(cohort_id,test_id) ON DELETE RESTRICT, and (cohort_id,tester_id) to cohort_tests(cohort_id,developer_id) ON DELETE RESTRICT.
- The current hosted catalog has the first FK but does not have assignments_cohort_tester_fk. It instead has separate assignments.cohort_id to cohorts.id ON DELETE CASCADE and assignments.test_id to tests.id ON DELETE CASCADE constraints alongside the composite cohort/test FK.
- This indicates that the hosted schema evolved beyond the recovered 070002 source. It is consistent with a later reconciliation/removal of the tester-to-developer composite FK, but does not prove the missing migration's exact SQL or intent. Do not recreate that FK: it equates assignments.tester_id with cohort_tests.developer_id, which may be an invalid assumption for tester/developer identities.
- The retained 20261109203006_restrict_report_assignment_deletion.sql source adds reports.assignment_id to assignments.id ON DELETE RESTRICT and makes the legacy remove_cohort_test RPC reject removal if related assignments have reports, feedback, check-ins, play-opt-in events, or non-pending activity. The live catalog confirms the reports FK is currently ON DELETE RESTRICT.
- V2 baseline 001_schema.sql keeps the assignment-to-cohort-test composite RESTRICT FK and cohort-test-to-test/developer composite RESTRICT FK. V2 cohort lifecycle code in 012_cohort_management.sql updates status and withdraws pending assignments on cancellation; it does not reproduce the legacy remove_cohort_test deletion RPC. Treat this as an API/workflow difference needing application-route and business-rule sign-off, not merely a DDL mapping.

Fresh exact row counts from the hosted database (read-only, 2026-11-26):
- assignments: 0
- cohort_tests: 0
- cohorts: 0
- tests: 0
- reports: 0
- report_attachments: 0

The zero counts remove current row-level blockers for these specific relationships at the time of this query, but do not validate the missing migration body, prove future data will remain empty, or remove the need for a final pre-cutover recheck.

### Required follow-up

1. Keep original migration 20261115092608 marked unrecovered until its source is located or a trusted database backup provides the exact body.
2. Compare legacy RPCs create_cohort, add_cohort_test, and remove_cohort_test with V2 cohort-management and tester-join APIs, including report/feedback/check-in retention semantics.
3. **Completed in isolated CI (PR #170; commit `b14ce1c478bd279a7906ad1af3c1d812b265323f`).** Added `030_cohort_assignment_delete_safety_contract.sql` for all four negative cases: cohort deletion with cohort_tests membership, test deletion with cohort_tests membership, assignment deletion with report history, and cancellation with an active assignment. GitHub Actions run #396 passed on 2026-11-26, including all 34 candidate SQL scripts, the configured contract suite, local PostgREST exposure checks, and disposable-stack teardown. PR #170 remains Draft/unmerged; this closes the test-coverage task only, not the separate legacy RPC/application semantics review.
4. Do not change hosted foreign keys or functions as part of this audit.
