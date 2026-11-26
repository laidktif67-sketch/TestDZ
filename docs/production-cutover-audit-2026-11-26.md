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


## Application route and cross-module integration inventory — 2026-11-26 (read-only)

A second targeted inspection of the official branch `rebuild/testdz-v2` reviewed the application route table and the shared Admin, Support, Wallet, and Notifications data APIs.

### Confirmed findings

- `apps/web/src/App.tsx` exposes Admin routes for the admin home, developer review queue, role requests, and role grants. These routes are nested under `RoleGuard(requiredRole="admin")`.
- The Support staff queue route `/support/queue` and ticket detail route `/support/:id` are nested under the general `AuthGuard`, not an explicit Support/Admin `RoleGuard`. This is not by itself proof of unauthorized data access: the queue API comment explicitly relies on V2 RLS for row visibility. Before cutover, verify that the database policies/RPCs enforce staff authorization independently of route visibility; client-side route guards must not be the security boundary.
- `apps/web/src/features/admin/admin-api.ts` routes role-request and role-grant RPC calls through the central `getAppDataClient()`. Therefore the global data-client feature flag changes the schema used by Admin APIs as well as tester/developer workflows; the flag is not a tester-only switch despite its name.
- `apps/web/src/features/support/support-api.ts` contains explicit V2 RPC paths for ticket creation, messaging, attachment registration, and staff updates, but also retains legacy direct-table insert fallbacks when V2 is disabled. Staff ticket listing reads `support_tickets` and relies on RLS. This dual-mode implementation requires policy and function-contract validation in both schemas before rollout.
- `apps/web/src/features/wallet/wallet-api.ts` intentionally avoids reading wallet balances and the points ledger when V2 is enabled. Its withdrawal preview remains explicitly legacy-only. The wallet/rewards and withdrawal routes still exist in the route table, so they must be treated as unavailable/disabled product capabilities under V2 until a V2 reward/withdrawal design and UI behavior are separately approved.
- `apps/web/src/features/notifications/notifications-api.ts` switches to role-scoped notification reads and V2 RPCs when the flag is enabled, while retaining direct legacy update fallbacks when disabled.
- The inspected tester dashboard API returns no wallet balance under V2 and uses `get_discoverable_tests`; the existing dashboard/discovery UI therefore needs explicit product acceptance of zero/hidden rewards during the V2 phase.

### Cutover implications

1. The feature flag must be treated as a whole-application database-schema switch for all modules that call `getAppDataClient()`, not as an isolated tester workflow toggle.
2. Verify Admin role-management RPCs, Support staff authorization/RLS, Notifications RPCs, and all shared profile/app APIs against the V2 schema before any flag activation.
3. Confirm that wallet, rewards, referrals, withdrawals, and other legacy-only capabilities are intentionally hidden or disabled for the V2 beta; route presence alone does not establish functional compatibility.
4. Inspect every remaining developer/admin/support page and all indirect database callers. This inventory is targeted and not a complete route-by-route certification.
5. No application code, feature flags, hosted database objects, data, or deployment settings were changed during this review.


## Admin and Support SQL-to-UI contract review — 2026-11-26 (read-only)

The route and API review was followed by a source-level comparison against candidate SQL scripts 019, 022–024, 028, 031, and 033, plus the corresponding contract tests.

### Confirmed compatible contracts

- Admin role-request UI calls `admin_list_pending_role_requests()` and `admin_review_role_request(uuid,text,text)`; candidate script 022 exposes those exact signatures. The UI enforces a 10–1000 character review reason, matching the database requirement. SQL additionally checks Admin role, rejects self-review, locks the pending request, and records the decision.
- Admin role-grant UI calls `admin_grant_role(uuid,text,text)`; candidate script 023 exposes that signature and enforces Admin role, no self-grant, allowed non-Admin roles, a valid target profile, and a 10–1000 character audit reason. Existing-role grants are idempotent and do not create a duplicate audit event.
- Notification UI calls `mark_notification_read(uuid,text)` and `mark_all_notifications_read(text)`; candidate script 019 exposes those exact role-scoped signatures and checks the caller's corresponding Tester or Developer/Admin role. This removes the earlier unscoped RPC signatures.
- Support ticket creation calls `create_support_ticket_for_role(text,text,text,text,text)`; candidate script 031 exposes that exact signature and verifies the requested Tester/Developer role is actually assigned to the caller. This protects dual-role accounts from creating a ticket under a role they do not hold.
- Staff ticket updates call `update_support_ticket(uuid,text,text,text)`; candidate script 024 checks Support/Admin authorization, allowed lifecycle transitions, and records an audit event with the reason.
- Candidate RLS in 002 grants ticket and conversation visibility to the ticket owner or Support/Admin. Requesters see only public messages; Support/Admin can see internal notes. Attachment visibility is further constrained to attachments on public messages, including for staff, by scripts 028/029.
- The apparent absence of a route-level Support RoleGuard is not an authorization bypass in the inspected component: `SupportStaffQueuePage` checks the identity roles and redirects non-staff users. Database RLS and RPC authorization remain the actual security boundary.
- Script 033 deliberately removes Support's broad SELECT access to raw assignments, check-ins, and feedback; Admin retains that visibility. This is a meaningful privacy restriction and should remain part of the beta acceptance criteria.

### Remaining risks / scope limits

- `/support/:id` is a shared customer/staff page. It requests `internal_note` in the V2 message query, but requester visibility relies on RLS filtering; this is consistent with the candidate policy and contract tests, but a browser-level check with separate requester, Support, and Admin accounts is still required to validate rendering and ensure internal-note labels/content never leak through client state.
- The support page uploads file bytes through the base Supabase Storage client and then registers metadata through the V2 RPC. This split is intentional, but requires end-to-end Storage bucket policy and signed-URL testing after a V2 environment exists.
- `getTesterSupportTicketDetails` uses one data path for requesters and staff. Confirm that the UI does not expose staff-only controls or internal notes to requesters even when a response is cached or the current identity changes.
- The V2 role/admin/support SQL contracts have source-level alignment and isolated contract coverage; this does not establish hosted deployment, production grants, or end-to-end browser correctness.

No source code, candidate SQL, production data, hosted policies, feature flags, or deployment settings were changed by this review.


## Developer, rewards, withdrawal, referral, and leaderboard review — 2026-11-26 (read-only)

Reviewed the Developer tests, monitoring, tester-management/invitations, feedback pages and their shared API against candidate V2 SQL scripts 003, 007–008, 012–016, 030, and 032, plus wallet/referral/withdrawal/leaderboard pages.

### Developer workflow alignment

- App management calls `get_app_limit`, `create_app`, `update_app`, `archive_app`, and `restore_app`; candidate script 003 exposes these exact public V2 RPC names and grants authenticated execution. App reads use the selected data schema and ownership-filtered queries.
- Developer test authoring calls `create_test`, `update_test`, `save_test_content`, and `submit_test_for_review`; candidate scripts 008 and 011 contain the corresponding lifecycle/content contracts. The API sends the full test input fields, including dates, duration and instructions, matching the V2 create/update function signatures.
- Cohort UI calls `create_test_cohort`, `update_test_cohort`, and `transition_test_cohort`; scripts 008 and 012 expose matching functions. No legacy `create_cohort`, `add_cohort_test`, or `remove_cohort_test` call was found in the inspected Developer tests page/API.
- APK builds and test assets use register/finalize RPC pairs and private Storage buckets; scripts 013 and 015 define the matching V2 helpers and Storage policies.
- Developer feedback UI uses `get_developer_feedback`, `update_developer_feedback_review`, `get_developer_feedback_messages`, and `send_developer_feedback_message`; script 016 exposes these contracts.
- Developer monitoring uses `get_developer_test_monitoring`; script 030 provides the matching function and privacy-aware aggregate response.
- Tester invitations use the `developer-invitations` Edge Function, while SQL script 032 defines invitation lifecycle functions. This needs an explicit Edge Function-to-SQL signature/configuration and secret audit; source-level page inspection alone does not prove deployed function compatibility.
- Developer pages are guarded by the Developer role in the route tree, and the pages additionally check V2 enablement or identity. This is consistent with the current staged rollout design.

### Rewards, wallet, referral, withdrawal, leaderboard findings

- The V2 schema does contain `wallets`, `wallet_ledger`, and `referrals` tables. However, tester workflow script 007 explicitly excludes tester points/rewards and cash withdrawals; the wallet UI deliberately returns no V2 wallet/ledger data and displays zero/empty values while V2 is active.
- The V2 wallet idempotency contract (test 009) exercises the private `post_wallet_entry` helper. That is not equivalent to an approved public tester reward-earning, redemption, or cash-withdrawal workflow.
- Withdrawal request UI is explicitly disabled under V2. The withdrawal status page is a static informational placeholder and does not load actual withdrawal records.
- Referral UI explicitly states tracking is not connected and does not create referral links or post rewards. The referral API has a history read path, but the current referral page does not present verified referral records.
- Leaderboard UI intentionally suppresses rankings and displays a notice until a secure approved V2 leaderboard service exists.
- Therefore wallet/rewards, cash withdrawals, referral rewards, and leaderboard are not available V2 beta capabilities despite some related schema tables existing. Do not infer functional readiness from table presence.

### Cutover acceptance requirements

1. Keep wallet balances and earned/purchased credits unavailable in V2 until product rules and public server-side posting/read APIs are approved and tested.
2. Keep cash withdrawal creation, review, payout, and status tracking disabled until the full ledger-backed workflow, country/payment controls, and Admin operations are implemented and tested.
3. Keep referral tracking/rewarding and global leaderboard hidden until verified V2 services and privacy-safe access controls exist.
4. Validate the `developer-invitations` Edge Function end-to-end against script 032, including secrets, idempotency, expiry, redemption, and revocation.
5. Run browser-level role-separated tests for Developer ownership, Tester participation, and Admin review; source and isolated SQL contracts do not replace end-to-end verification.
6. The current V2 feature flag remains a whole-app data-schema switch; no flag or application code was changed during this review.

No production data, hosted database objects, feature flags, application source, or deployment settings were changed.


## Edge Function deployment, Admin review queue, and Storage cutover review — 2026-11-26 (read-only)

### Developer invitation Edge Function

- Reviewed `supabase/functions/developer-invitations/index.ts`, its local `supabase/config.toml` entry (`verify_jwt = true`), the Developer Testers UI, migration 032, and contract test 028.
- Function authenticates the supplied bearer token with `supabase.auth.getUser(accessToken)`; it does not trust decoded client claims for identity.
- Create/list/revoke/redeem calls use the exact V2 RPC names and parameter shapes defined by migration 032.
- The SQL contract covers owner-only creation/listing, idempotent retries, email masking, rejection of a different confirmed email, atomic join + acceptance, revocation, and role denial.
- The UI explicitly tells the Developer that the link is not emailed and must be copied/shared manually. This matches the function response `delivery_status: not_emailed`; automated email delivery is not implemented.
- The token is generated deterministically with HMAC-SHA256 over authenticated user ID + idempotency key, with the secret held in Edge Function environment. The raw token is returned only on create; SQL stores only the SHA-256 hash. The code comment in migration 032 says “random token”, which does not precisely describe the current deterministic HMAC implementation and should be corrected for documentation accuracy before release.
- **Hosted deployment check:** Supabase production Edge Function listing returned an empty functions array. Therefore `developer-invitations` is not currently deployed in the hosted project, and no hosted secret/configuration or live endpoint test can be claimed. This is consistent with V2 not being cut over; do not deploy it to production as part of this audit.

### Admin application/test review queue

- The route `/admin/developer-reviews` is inside the Admin RoleGuard.
- The page is gated by the V2 feature flag, loads submitted apps/tests, and calls `review_app` / `review_test` with a required decision reason.
- Candidate migration 008 sets both apps and tests to `submitted` when submitted and only allows Admin review; approval transitions apps to `published` and tests to `recruiting`, while rejection transitions to `rejected` / `failed`.
- The frontend query filters `status = 'submitted'`, matching the SQL lifecycle state.
- Candidate admin review RPCs and queue query are source-aligned. Live role-separated browser checks and V2 runtime validation are still required; no hosted V2 review queue exists today.

### Storage bucket and policy reconciliation

- Candidate migration 006 creates/configures five buckets using `ON CONFLICT (id) DO NOTHING`; migration 013 adds private `test-builds`; migration 015 adds private `test-assets` and explicitly updates that bucket's settings on conflict.
- Existing production currently has five legacy buckets and no V2 schema. Consequently the two V2 buckets are not present as part of the existing production inventory, and the candidate policies are not deployed there.
- Because migration 006 does not update settings for pre-existing bucket IDs, a future cutover cannot assume that running the candidate SQL over existing buckets will reconcile public/private flags, size limits, or MIME allowlists. A separately reviewed, explicit bucket configuration diff and object migration/retention plan is required before cutover.
- Candidate Storage policies are path/ownership/status scoped for app icons, support attachments, developer feedback attachments, test evidence, APK builds, and test assets. The APK helper was hardened in migration 014; test asset read policy permits only owner, Admin/Support, or assigned testers after upload.
- Isolated SQL contracts and source inspection do not prove Storage upload/download/signed-URL behavior in a deployed V2 environment. Browser tests must cover wrong-owner access, pre-finalization reads, post-finalization participant reads, closed/removed assignments, and MIME/size mismatch rejection.

No hosted Edge Function was deployed, no secrets were changed, no Storage bucket or policy was changed, and no application or database source was modified.


## Storage test coverage and final workflow gap review — 2026-11-26 (read-only)

### What the current isolated suite does prove

- `tests/006_test_media_assets_contract.sql` executes actual Storage object INSERT/SELECT RLS for `test-assets`, including owner upload, MIME/extension mismatch, oversized metadata, participant read, and unrelated tester denial; it rolls back synthetic rows.
- `tests/029_support_attachment_privacy_contract.sql` checks requester, Support, Admin, and unrelated-user access to public-message versus internal-note support attachments, including Storage object visibility.
- Candidate `final_state_contract.sql` checks the seven expected buckets and the final 48-table / 47-policy table contract.
- The workflow runs these contracts in a disposable local Supabase stack and shuts that stack down afterwards.

### Remaining test coverage gaps

1. **APK build Storage path:** migration 013 defines a private `test-builds` bucket, owner/status-scoped upload helper, participant read helper, and register/finalize RPCs. The inspected test suite has no dedicated contract that inserts an APK build row, rejects another developer's upload, verifies size/MIME at finalize, and proves participant versus outsider read access. The existing media contract 006 covers `test-assets`, not `test-builds`.
2. **Tester feedback reply:** migration 034 adds `get_tester_feedback_messages()`, but no dedicated SQL contract file exists and the workflow contract array does not run a migration-034-specific contract. This leaves tester-side reply visibility/role separation without direct isolated contract evidence.
3. **New cohort delete-safety contract:** the separate Draft PR #170 contains the proposed cohort/assignment deletion safety test, but it is not part of the official branch's current workflow until that PR is reviewed and merged. Its CI success on the PR branch is not evidence that the official branch currently runs it.
4. **Bucket configuration reconciliation:** migration 006 explicitly leaves existing bucket configuration untouched on conflict, and migration 013 also uses `DO NOTHING` for `test-builds`. Migration 015 updates `test-assets` configuration on conflict, unlike those earlier migrations. A future cutover needs an explicit reviewed reconciliation plan for the pre-existing buckets and the two V2 buckets, including public/private status, size limits, MIME allowlists, and object inventory/retention. Do not silently alter existing production buckets as part of a schema migration.
5. **Storage runtime semantics:** direct SQL contracts exercise Storage RLS predicates and object metadata, but do not fully substitute for actual Storage API upload/download/signed-URL tests. Those remain a post-deployment V2-environment acceptance requirement, with no production deployment implied.

### Current conclusion

The existing isolated contracts provide meaningful evidence for test assets and support attachments, but do not yet fully certify the APK build bucket or the tester feedback reply path. These are explicit Beta acceptance blockers until covered by isolated contracts and, for Storage API behavior, browser/API integration tests.

No workflow, SQL, application source, hosted bucket, or production setting was changed in this review.


## Correction and follow-up — feedback reply coverage, plus APK build contract PR — 2026-11-26

A re-check of the official branch's existing `tests/008_developer_feedback_privacy_contract.sql` corrected the earlier gap statement: the existing contract already exercises the tester's own developer reply through `get_tester_feedback_messages()` and rejects a non-tester role. The remaining useful edge case is cross-tester isolation, which is now added to Draft PR #171.

PR #171 (`test/apk-build-storage-contracts`) added:
- `tests/030_apk_build_storage_contract.sql`: owner-only APK build registration; outsider upload denial; finalization rejection for mismatched size/MIME; successful finalization; assigned-tester read and unrelated-tester denial across metadata and Storage objects.
- An additional tester fixture and explicit zero-row assertion in test 008, proving a different tester cannot read another tester's developer reply.
- The new APK contract in `.github/workflows/rebuild-v2-tests.yml`.

At the time of the initial review, PR #171 was Draft / open and its CI was still running. It subsequently passed run #397 (ID `45895473137`) and was approved by the project owner, then merged into `rebuild/testdz-v2` with merge commit `66d5ccf96389c1a398b921e3c46fb8eeff33b6bd`. The contract uses transaction rollback and disposable local Supabase CI only.

No production data, hosted Storage buckets, hosted Supabase configuration, migrations, application runtime code, or Vercel deployment were changed.


## PR #171 isolated CI result — 2026-11-26

The GitHub Actions run associated with PR #171 commit `6bc710ac3dc0c4c4cfddea20e25b555383e4b661` completed successfully:
- Run #397 / run ID `45895473137`: conclusion `success`.
- `rebuild-v2`: local disposable Supabase stack startup, candidate SQL application, all listed SQL contracts (including new `030_apk_build_storage_contract.sql`), PostgREST checks, and stack shutdown all completed successfully.
- `frontend-typecheck`: success.
- `notification-edge-function`: success.

The PR remains Draft / open and unmerged. Its compare against `rebuild/testdz-v2` is 3 commits ahead, 0 behind, with exactly three changed files: the workflow list, feedback privacy contract 008, and new APK build contract 030.

This is passing isolated CI evidence only. It does not establish hosted Storage API upload/download/signed-URL behavior or production cutover readiness. No hosted Supabase changes or Vercel deployment were made.


## PR #171 merge disposition — 2026-11-26

PR #171 was approved by the project owner and merged into `rebuild/testdz-v2` using a merge commit:
- Merge commit: `66d5ccf96389c1a398b921e3c46fb8eeff33b6bd`.
- PR #171 is closed / merged.
- The merged changes are limited to the isolated CI workflow contract list, feedback privacy contract 008, and APK build Storage contract 030.
- The pre-merge CI run #397 was successful. No additional workflow run was returned for the merge commit at verification time.

This merge changes tests and CI only. It does not deploy candidate SQL to hosted Supabase, alter production data/schema/Storage, deploy Edge Functions, or publish to Vercel. Hosted Storage API behavior and production cutover remain unverified.


## Production read-only re-verification after PR #171 — 2026-11-26

A fresh read-only query against hosted project `naqjjykcglxiobkmdllj` confirmed:
- PostgreSQL 17.11.
- No `rebuild_v2` or `rebuild_v2_private` schema exists.
- `public` contains 42 base tables.
- Hosted migration history contains 43 records.
- Storage contains five buckets: `app-icons`, `avatars`, `developer-feedback-attachments`, `support-attachments`, and `test-evidence`.
- The Edge Function listing is empty.

The five hosted buckets retain their existing configuration; no V2 buckets are deployed. This is consistent with the V2 candidate remaining isolated from Production. No DDL, data, migration history, bucket configuration, Edge Function, secret, or deployment was changed during this verification.

PR #169 remains Draft / open. Its branch is now four commits behind `rebuild/testdz-v2` after PR #171 was merged. The audit content remains a documentation-only change; synchronize the branch before considering merge, and obtain explicit owner approval before any branch merge.


## Follow-up verification — cohort FK catalog and PR #170 — 2026-11-26

A fresh read-only query against hosted Production confirmed the applied migration history still contains 43 records, including the exact hosted history entry `20261115092608 / reconcile_assignments_cohort_foreign_keys`. This confirms the version/name record exists, but the migration-list API does not expose its original SQL body.

The current hosted FK catalog was queried directly:
- `public.assignments` has validated `(cohort_id,test_id) -> cohort_tests(cohort_id,test_id) ON DELETE RESTRICT`.
- It also retains separate validated `cohort_id -> cohorts(id) ON DELETE CASCADE` and `test_id -> tests(id) ON DELETE CASCADE` FKs, plus tester/profile and medical-exception reviewer references.
- `public.cohort_tests` has validated cohort and developer RESTRICT references, a composite `(test_id,developer_id) -> tests(id,developer_id)` reference, and a separate `test_id -> tests(id) ON DELETE RESTRICT` reference.
- Both `assignments` and `cohort_tests` currently contain zero rows.

This supports that the intended composite assignment-to-cohort-test relationship is present in Production. It does **not** prove that PR #36's candidate file is the exact SQL body executed under hosted version `20261115092608`; the candidate file version is `20261115000100`, and the live catalog contains additional FK edges. Keep exact SQL provenance classified as unrecovered.

### PR #170 cohort deletion-safety contract

PR #170's workflow run `45893146158` was independently rechecked: all three jobs completed successfully (`rebuild-v2`, `frontend-typecheck`, and `notification-edge-function`). Its SQL contract covers cohort deletion, test deletion, report-retained assignment deletion, and rejection of cancellation while an active assignment exists. The contract uses synthetic fixtures and transaction rollback in disposable local Supabase CI only.

PR #170 remains Draft/open and unmerged. Its branch is four commits behind the current official branch and three commits ahead, so it needs a reviewed synchronization and a fresh CI run before any merge decision. No merge or deletion was performed.

### Current official CI note

The PR #171 pre-merge CI run passed, but the GitHub workflow/status lookup for merge commit `66d5ccf96389c1a398b921e3c46fb8eeff33b6bd` returned no associated runs or status checks. Do not describe the merge commit itself as having a fresh passing CI run; the passing evidence is the PR head run recorded above.

No Production SQL, schema, data, migration history, Storage, Auth, Edge Functions, or Vercel settings were changed during this follow-up.



## Official branch synchronization and PR #170 disposition — 2026-11-26

The audit branch was synchronized with the official `rebuild/testdz-v2` branch after PR #170 was merged.

- Official merge commit: `19f43a7a2916997bd20a781e883132350dc826f0`.
- Audit branch synchronization merge commit: `c9cb752a2941bffc7dd4073d55c68d40b7770a6f`.
- The synchronization used a normal two-parent merge commit; no force push was used.
- The audit document remains the only PR #169 change. No application, migration, workflow, or production database files were added by PR #169.

### PR #170 cohort/assignment delete-safety contract — merged

PR #170 was approved by the project owner and merged into the official branch:

- PR #170: closed / merged.
- Merge commit: `19f43a7a2916997bd20a781e883132350dc826f0`.
- Its isolated CI run `45896559702` completed successfully on PR head `025fe3ca9b3bb689e3460ee8f1edf92805795edd`; all three jobs passed: `rebuild-v2`, `frontend-typecheck`, and `notification-edge-function`.
- The merged change adds the cohort/assignment deletion-safety SQL contract and registers it in the local disposable-database workflow. It does not modify production SQL, application runtime code, or hosted resources.

This supersedes earlier statements in this audit that PR #170 was Draft/unmerged or awaiting synchronization. The successful run is evidence for the PR head before merge; a separate workflow run on the merge commit was not returned at verification time.

### Current audit branch state

The audit branch now contains the official PR #170 merge and remains a documentation-only branch intended for PR #169 review. The PR must still be reviewed as documentation and must not be treated as authorization for Production cutover. Exact hosted SQL source for migration version `20261115092608` remains unrecovered; no new evidence changes that classification.

No Supabase Production schema, data, migration history, Auth settings, Storage configuration, Edge Functions, secrets, or Vercel deployments were changed by this synchronization or audit update.
