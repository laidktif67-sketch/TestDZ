# Tester Workflow — V2 Schema/Frontend Contract Review

Branch: `rebuild/testdz-v2`  
Scope: candidate SQL, FixLab catalog metadata, tester page contracts, and rollback-only synthetic contract verification.  
Safety: no persistent database changes; synthetic Auth rows and Storage objects exist only inside a transaction that is rolled back. No Production access.

## Verified FixLab baseline

Project: `TestDZ-FixLab` (`bxjqwqidmxxnsgnpyzxv`), PostgreSQL 17.11, ACTIVE_HEALTHY.

- 43 tables in `rebuild_v2`; all 43 have RLS enabled and FORCE RLS.
- 44 RLS policies.
- 6 user-defined triggers on V2 tables.
- The pre-007 baseline contained 13 exposed RPCs. Script `007_tester_workflow.sql` adds the narrow tester discovery, enrollment, assignment, check-in, feedback, and final-submission RPC wrappers.
- All V2 tables currently report zero rows.
- Authenticated has SELECT on V2 tables; no direct table INSERT/DELETE grants were found in the role-table grants snapshot. The only intended column-level UPDATE grant is the safe profile-field grant.
- The inspected candidate schema and live FixLab catalog agree on the tester workflow table definitions.

## Confirmed contract mismatches

### Assignment model

V2 `assignments` has:
- `assigned_at`, `started_at`, `completed_at`, `due_at`
- `status`: pending / active / completed / withdrawn / failed / rejected
- no `start_date` and no `points_awarded`

The current pages expect `start_date` and, in some views, `points_awarded`. The V2 adapter must map `started_at` to the UI's start date and must not synthesize points from client data.

### Evidence model

V2 `checkins` stores `evidence_path`; current progress/history pages query `evidence_url`. The new adapter must use private Storage paths and signed URLs at read time; it must not persist public URLs in the database.

### Wallet model

V2 has `wallets.earned_points`, `wallets.purchased_credits`, and immutable `wallet_ledger`. Current tester pages query `points_ledger`, which is not a V2 table. No tester reward-posting RPC exists yet. Do not award points or expose a client-controlled amount in this workflow phase.

The product distinction remains: tester earned points are not developer purchased credits. Cash withdrawal is out of scope.

### Final submission model

The current assignment submission form collects:
- a final results summary (max 2,000 chars),
- optional comments (max 500 chars),
- up to 5 evidence files (PNG/JPG/WebP/PDF, max 10 MB each).

V2 `reports` is an incident/reporting table (report_type values include no_activity, fake_feedback, app_broken, harassment, payment_dispute, other). It is not a final assignment submission table. V2 `report_attachments` references `reports`, so it must not be repurposed for final assignment submissions.

A dedicated assignment-submission entity and attachment metadata model are required before wiring the final submission page. Existing `test-evidence` Storage helpers currently require a matching `reports` row, so they are not yet a valid upload path for the final assignment form.

### Feedback

V2 `feedback` has one row per assignment, with `body` 20–8,000 chars, category enum, optional rating, and server-owned `quality_status` / `reviewed_by` / `reviewed_at`. Submission must be via a narrow RPC that derives tester identity from `auth.uid()` and never accepts review fields from the browser.

Current Submit Feedback page has no backend submission call. Feedback History reads the legacy points ledger and needs a V2 adapter.

## Security finding to fix in the candidate layer

The existing `cohorts_select_participants_v2` policy contains an apparent invalid ownership predicate:

```sql
a.cohort_id = a.id
```

This compares a cohort ID to the assignment's own ID, rather than correlating the assignment to the outer `cohorts.id`. As written, the tester-participant branch cannot grant cohort visibility. A candidate-only replacement policy should correlate `a.cohort_id = cohorts.id` and verify tester ownership. Keep developer/admin/support branches unchanged.

## Enrollment and capacity design constraints

- Enrollment must choose a `cohort_tests` row for the requested test.
- Capacity is stored on `cohorts`, not `tests`; serialize enrollment by locking the selected cohort row and count assignments for that cohort before inserting.
- Keep the unique `(test_id, tester_id)` constraint as a second line of defense.
- Release a seat only for explicitly non-counting states (at minimum withdrawn/rejected); completed or failed participants should not silently free a seat.
- `eligibility_criteria` is currently an unconstrained JSON array with no verified machine-readable contract in the tester UI. Do not invent an eligibility parser. Before automated gating, define and validate its supported JSON shape; until then the RPC should expose criteria as information and apply only verified hard constraints.

## Safe implementation sequence

1. Add a candidate-only SQL file outside active migrations. It should:
   - replace the faulty cohort SELECT policy;
   - add read-only discovery and secure join/start/check-in/feedback RPCs;
   - add a dedicated final assignment-submission table and attachment metadata (do not overload `reports`);
   - update the private Storage helper/policies to bind evidence to the dedicated submission model;
   - keep reward posting out until the tester-points policy and review/approval lifecycle are explicitly defined.
2. Test all RPCs in FixLab with synthetic identities inside rollback-only transactions where feasible. Do not create persistent Auth users or leave test rows/objects behind.
3. Add a separate V2 Supabase client/adapter; do not change the legacy client globally.
4. Integrate one page slice at a time and replace legacy field assumptions with explicit mapping.
5. Run SQL contract tests, cross-user/role/duplicate/capacity race checks, TypeScript, lint, and build.
6. No Production SQL, active migration promotion, PR #18 changes, Auth deletion, or Storage cleanup without explicit approval.

## Implementation checkpoint — 007

Candidate implementation is now saved in `supabase/rebuild-v2/007_tester_workflow.sql` and applied only to TestDZ-FixLab.

Implemented:
- Corrected `cohorts_select_participants_v2` tester ownership correlation.
- Read-only `get_discoverable_tests` RPC with cohort capacity filtering and app/test display fields.
- Atomic `join_test` with tester-role/account checks, advisory lock per tester+test, cohort row locks, capacity count, and idempotent return for an existing pending/active assignment.
- `start_assignment`, `submit_checkin` (once per server day, idempotent), and `submit_tester_feedback` (server-owned quality/review fields).
- Dedicated `assignment_submissions` and `assignment_submission_attachments` tables, private RLS read policies, metadata registration, upload-path authorization, and idempotent finalization.
- Finalization transitions the assignment to completed only after every registered attachment is present in the private `test-evidence` bucket. No reward is posted.

Verification in FixLab:
- The rollback-only contract script `supabase/rebuild-v2/tests/007_tester_workflow_contract.sql` passed.
- Tested discovery, join idempotency, start, daily check-in idempotency, feedback, attachment registration, upload/read helper authorization, finalization idempotency, cross-user assignment/feedback denial, and capacity filtering.
- Extended the contract test to explicitly assert that a second authenticated tester cannot read or upload evidence belonging to another tester's final submission. The updated script was rerun against TestDZ-FixLab and completed without exceptions; the post-rollback cleanup result was zero for every checked table and Storage object count.
- The post-rollback cleanup query returned zero for synthetic Auth users, profiles, apps, tests, assignments, check-ins, feedback, submissions, attachment metadata, and Storage objects.
- Both new tables have RLS enabled and FORCE RLS. Client write grants remain absent; only SELECT and narrow RPC execution are exposed.
- The `authenticator` role's PostgREST exposed-schema setting was extended to include `rebuild_v2` on FixLab only, then config/schema reload notifications were sent. Production was not changed.
- The Supabase Security Advisor on FixLab reports four INFO findings in legacy `public` tables (`audit_logs`, `fraud_reviews`, `platform_config`, `user_roles`) with RLS enabled and no policies. This is default-deny behavior, not evidence of public access; verify whether the absence of policies is intentional before changing it.
- The Performance Advisor reports 31 unindexed foreign keys and 23 unused indexes across the mixed legacy/V2 FixLab database. Among the reported V2 foreign keys are the composite submission identity relation and attachment tester/submission relations. These are performance follow-ups, not authorization failures; do not drop unused indexes without workload evidence.

Frontend checkpoint:
- Added `apps/web/src/lib/supabase-v2.ts`, reusing the active Supabase session and requiring `VITE_TESTER_WORKFLOW_V2_ENABLED=true`.
- Discovery list, test preview/enrollment, assignment details, assignment start/progress, daily check-in, feedback submission, and final assignment submission now have V2 code paths behind that feature flag; the legacy path remains the default when the flag is absent/false.
- Final submission creates or updates a server-side draft, registers evidence metadata before upload, uploads privately to `test-evidence`, and calls finalization. Retry paths reuse the draft and already-uploaded files where metadata matches.
- Tester feedback is associated with the assignment ID passed from the progress page. The current feedback UI hides its local-only attachments while V2 is enabled because the V2 feedback model does not yet provide an attachment workflow.
- The progress page deliberately shows no assignment reward credit in V2 mode; reward posting remains excluded.
- No Vercel environment variables were changed. The V2 code path is off unless `VITE_TESTER_WORKFLOW_V2_ENABLED=true` is explicitly set; verify the target environment before enabling it. Do not enable the flag until the V2 schema and exposed-schema configuration are deployed to that same target project.
- TypeScript/build/Browser verification has not yet been run; no claim of frontend build success is made.

Frontend follow-on checkpoint — history and rewards guardrails:

- `TesterDashboardPage` now reads V2 profile, wallet, assignments/check-ins, discoverable tests, and notification counts. `ActivityHistoryPage` now reads V2 assignments, check-ins, feedback, and earned-points ledger entries.
- `MyTestsPage` now reads V2 roles, profile, wallet, assignments, test/app relations, check-ins, feedback, and notifications when the feature flag is enabled. V2 assignment dates are mapped from `started_at` / `assigned_at`; no client-supplied `points_awarded` is synthesized.
- `CheckInHistoryPage` reads V2 check-ins and assignment/test/app context. V2 evidence links remain intentionally unavailable: the V2 `submit_checkin` RPC accepts only assignment ID and note, does not register an evidence object, and the private Storage read helper recognizes report attachments and final-submission attachment metadata only. A raw `checkins.evidence_path` value alone is therefore not sufficient authorization for a signed URL. Do not expose or sign it until a dedicated check-in evidence registration/upload model and matching Storage authorization are implemented and tested.
- `FeedbackHistoryPage` now reads V2 feedback and review state. Reward totals are shown as unavailable in V2 rather than inferred from the legacy points ledger.
- `NotificationsCenterPage` now reads V2 notifications and marks them read only through `mark_notification_read` / `mark_all_notifications_read` RPCs; direct client updates remain only in the legacy path.
- `WalletRewardsPage` now reads only `earned_points` ledger entries in V2 (while displaying `purchased_credits` as a separate balance), and hides withdrawal entry points. `WithdrawalRequestPage` also blocks direct-route access while V2 is enabled.
- `TesterLeaderboardPage` deliberately hides global rankings in V2 until a secure leaderboard RPC is designed and verified. Assignment details and final submission no longer display fallback reward amounts.
- The V2 feature flag remains off by default. No Production SQL, Vercel environment variables, Auth deletion, Storage cleanup, or PR #18 changes were made.

Remaining verification:
- TypeScript, frontend build, and browser workflow have **not** been run. The CI workflow was updated to include `rebuild/testdz-v2`, but the available GitHub workflow-run lookup only returns pull-request-triggered runs and therefore cannot confirm the push run. This is not a successful build.
- Check-in evidence remains a known feature gap. The FixLab catalog confirms `checkins.evidence_path` exists, but `submit_checkin(assignment_id,note)` never sets it and there is no dedicated check-in attachment metadata table or matching Storage helper branch. The attempted frontend signed-URL path was reverted; V2 history does not expose an unverified evidence URL.
- The `join_test` implementation uses a transaction-scoped advisory lock for a tester+test and `FOR UPDATE` row locking on candidate cohorts before counting seats. This is the intended last-seat serialization design, but a true two-session concurrent race test has not been executed.
- Run a true two-session race test for the final cohort seat.
- Repeat FixLab SQL contract tests after any subsequent SQL changes; no Production rollout is authorized.


## Follow-up verification — 2026-11-15

### Branch and CI state

- The observed GitHub Actions push run is run `43745468748` on branch `rebuild/testdz-v2`, commit `7f40f3b1d1687cb116d32f177ff26fff4346f4d4` (`Keep check-in evidence hidden until dedicated storage authorization exists`). A later branch comparison confirms the current branch head has advanced beyond that commit; the latest documentation-only commit does not match the CI workflow's configured path filters.
- The original `web` job failed with no recorded steps, `runner_id=0`, and no runner name. A retry of that same job was requested; the retry also failed immediately with an empty steps array. This indicates the job failed before any configured npm/typecheck/build step ran. The precise platform-side cause is unavailable from the exposed job metadata; do **not** attribute it to application code.
- The combined status on current branch head `b215d18373f61a0ae799958233a2196938433226` reports Vercel `failure` and target URL indicating `upgradeToPro=build-rate-limit`. This is a Vercel build-rate-limit status, not evidence of an application compile error.
- Frontend TypeScript/build/browser verification remains **pending** because neither GitHub job reached its steps and Vercel did not complete a build. No Vercel settings or environment variables were changed.

### FixLab foreign-key index follow-up

- Re-ran the FixLab Performance Advisor. It still reports 31 unindexed foreign keys and 23 unused indexes across legacy `public` and candidate `rebuild_v2` objects.
- A read-only catalog check confirmed the following candidate V2 relations:
  - `assignment_submissions.tester_id` is covered by `assignment_submissions_tester_created_idx`.
  - `assignment_submissions.assignment_id` is covered by the unique `assignment_id` index.
  - `assignment_submission_attachments.submission_id` is covered by the unique `(submission_id,file_id)` index.
  - `assignment_submission_attachments.tester_id` has no dedicated leading-column index.
  - The composite identity foreign keys begin with `assignment_id` / `submission_id`, respectively, and those leading columns already have indexes; the Advisor still flags the composite constraints because there is no exact full-column-prefix index.
- The candidate tables currently contain zero rows and no representative production-like workload is available. Do **not** add redundant composite indexes or remove Advisor-listed unused indexes solely to silence the linter. Revisit the attachment `tester_id` index when workload/EXPLAIN evidence demonstrates a material benefit.

### Concurrency verification

- The current Supabase SQL connector exposes single SQL execution calls; no supported second independent PostgreSQL session or transaction-coordination mechanism was available in this pass.
- A true two-session last-seat race test is therefore still **pending**. The advisory-lock + cohort-row-lock implementation remains a design review result, not a concurrency-test pass.
- No SQL writes, migrations, schema changes, Storage changes, Auth changes, or Production operations were performed in this follow-up.


### Branch-head and CI retry clarification

- The current `rebuild/testdz-v2` branch head was rechecked by comparing it with commit `87a65f3c9aeaf5a517fb284408a10e537d94d596`; the branch is one commit ahead, at `b215d18373f61a0ae799958233a2196938433226`.
- Comparing the failed-run commit `7f40f3b1d1687cb116d32f177ff26fff4346f4d4` to the current branch shows the run commit is an ancestor, with three later commits on the branch.
- A retry of the failed `web` job was initiated. It again terminated before step execution (`steps=[]`). This retry is diagnostic only and does not establish a code failure or pass.


### Check-in history points presentation

- Updated `CheckInHistoryPage` so V2 no longer presents a fabricated zero-point balance. The KPI now says points are unavailable while V2 reward posting is disabled; the table and CSV export use an explicit unavailable label. Legacy mode retains its existing linked-points display.
- This is a frontend presentation correction only. It does not add reward posting or change wallet/ledger data.

### CI result for the presentation correction

- Push run `43745958426` was created for commit `2724f45c86ea6a194b9ddf2e620ef932f4f7dfdc` and concluded `failure`.
- Its only `web` job returned an empty steps list. Therefore the configured `npm install`, `npm run typecheck`, and `npm run build` steps did not run. The run provides no evidence for or against source correctness.
- The combined status still shows Vercel `failure` with `upgradeToPro=build-rate-limit`.
- The new JSX and CSV output were read back from GitHub and the exact expected V2 labels were verified in the committed file; this is source-level verification, not a TypeScript/build pass.


### Diagnostic retry of the Check-in History CI run

- Retried the `web` job for run `43745958426` (commit `2724f45c86ea6a194b9ddf2e620ef932f4f7dfdc`). The retry again concluded `failure` with an empty steps list.
- Since the original attempt and retry both stop before any step, the CI blocker is currently outside the visible project commands. Keep the code verification status pending until a runner actually executes the workflow.


### Follow-up: points and evidence presentation across V2 tester pages

- Rechecked the remaining tester-facing pages for legacy reward displays and the unsupported check-in-evidence assumption.
- Updated `MyTestsPage` so the hero balance, points KPI, and history points column show **Unavailable** while V2 reward posting is disabled. This avoids presenting the empty V2 wallet as a real zero-point earned balance. Legacy mode keeps its previous display.
- Updated `ActivityHistoryPage` so its total-points KPI, assignment points column, and CSV export explicitly report points as unavailable in V2. Legacy mode is unchanged.
- Updated `ActiveAssignmentProgressPage`:
  - The evidence task now explains that V2 evidence is attached to the assignment submission and that check-in evidence is not supported yet.
  - The reward panel now says **Unavailable** instead of `+0 pts` while reward posting is disabled.
  - The existing V2 check-in evidence URL remains null; no raw `evidence_path` or unsupported signed URL was introduced.
- Earlier in this same follow-up, `TestCompletionRewardPage` and `TestCompletionSummaryPage` were guarded from legacy ledger reads and redirect to Wallet & Rewards while V2 is enabled.
- Source files were read back from GitHub after each update and the expected V2 conditional labels/guards were verified. This is source-level verification only; TypeScript/build is still not verified.

### Latest branch head and CI status

- Latest verified `rebuild/testdz-v2` head at the time of this note: `43f6fd7289fe7315b6abc1d579fb764acf34dee8`.
- Compared with `87a65f3c9aeaf5a517fb284408a10e537d94d596`, the branch is ahead by 10 commits and behind by 0.
- Latest GitHub Actions run `43747141597` for that head concluded `failure`. Its `web` job (`132912841593`) again returned `steps: null` and no logs URL. This does not show that npm install, typecheck, or build ran.
- The latest Vercel combined status remains a build-rate-limit failure. No Vercel configuration or environment variables were changed.
- No SQL, migration, Storage, Auth, Production, or PR #18 changes were made in this frontend follow-up.


### Further V2 reward-state consistency pass

- Extended the same explicit unavailable-state treatment to the remaining high-traffic tester reward surfaces:
  - `TesterDashboardPage`: points KPI and reward summary no longer imply that a zero balance is a posted V2 reward result.
  - `DiscoverTestsPage`: reward card and quick-stat points now identify reward posting as disabled.
  - `WalletRewardsPage`: total points, points-chart caption, and milestone panel now explain that reward posting/milestones are not enabled in this V2 phase. Legacy mode retains its prior values and milestone UI.
- Together with the preceding updates, the V2-facing tester surfaces now consistently avoid presenting zero as a verified reward amount in Check-in History, My Tests, Activity History, Active Assignment Progress, Dashboard, Discover Tests, and Wallet & Rewards.
- V2 completion reward and completion summary pages remain guarded from legacy ledger reads.
- Read-back verification confirmed the conditional V2 copy is present in the updated source files. No local TypeScript/build run was available, so this is not a compile pass.

### Latest CI after reward-state consistency changes

- Latest verified branch head: `a5f578188a6dff79b959edfb6fc3da0348a9b59b`.
- Compared with `87a65f3c9aeaf5a517fb284408a10e537d94d596`, branch is ahead by 14 commits and behind by 0.
- GitHub Actions run `43747281313` for this head concluded `failure`; the `web` job `132913259268` again returned `steps: null` and no logs URL.
- The repeated pre-step failure still does not establish a source-level failure. TypeScript/build remain pending. Vercel build-rate-limit remains unresolved.
- No production database, FixLab database, Auth, Storage, SQL, migration, Vercel settings, environment variables, or PR #18 were changed during this frontend-only pass.

### Tester settings, privacy, support, and security route audit — 2026-11-15

Read-only source review at branch head `7d844a6afb9224a68670530d441cc4650674caa1`. No source, database, Storage, Auth, Production, or deployment changes were made in this audit pass.

Confirmed V2 integration gaps requiring a follow-up adapter/decision before enabling the feature flag for a complete tester experience:

- `PrivacyDataManagementPage` has no V2 branch. Its profile, assignments, check-ins, feedback, notifications, and points export queries use the legacy public schema; it queries `public.points_ledger`, while the candidate schema exposes `rebuild_v2.wallet_ledger` with a different contract. Both JSON and CSV exports therefore remain legacy-only and will not represent the V2 dataset accurately. Privacy preferences and export-request history are stored in Auth user metadata; these are separate from the relational V2 records.
- `SettingsSecurityPage` and `LanguageAppearancePage` read/update `public.profiles`. V2 defines a separate `rebuild_v2.profiles` table. Auth password/email/MFA operations and user-metadata preferences are Supabase Auth operations, but profile display-name/avatar/locale reads and locale/profile writes need an explicit V2 path or a documented shared-profile strategy.
- `SupportCenterPage` and `SupportTicketDetailsPage` still read/write legacy `public.support_tickets`, `public.support_ticket_messages`, and `public.support_ticket_attachments`. Candidate V2 equivalents exist under `rebuild_v2` and have a distinct `requester_role` field and composite attachment-to-message relationship. The details page also uploads to the `support-attachments` bucket and creates signed URLs directly; V2 Storage bucket/policy/helper compatibility was not established in this source review. Do not switch these Storage operations merely by changing the database schema qualifier.
- `ActiveSessionsPage` and `LoginActivitySecurityPage` call `public.get_my_active_sessions` and `public.get_my_security_activity`. The inspected V2 workflow client exposes the `rebuild_v2` schema; no V2 equivalents for these RPCs were verified in the inspected candidate workflow SQL. Supabase Auth sign-out/password/MFA methods are separate and remain Auth operations.
- `ReferralProgramPage` and `ReferralHistoryPage` still use legacy profile/notification queries for surrounding account UI. Their referral records are currently local/empty presentation rather than a verified V2 referral workflow; do not present these pages as a live V2 referral system.
- `WithdrawalRequestPage` was checked separately: it returns an explicit “Withdrawals are not enabled” state before rendering the legacy form whenever the V2 feature flag is enabled, and its legacy wallet query is skipped in that mode. This guard is present and was not changed.

Route wiring:
- `App.tsx` wires the settings, privacy, active-session, security-history, support, withdrawal, and tester workflow pages under the authenticated route tree. Tester-only pages are additionally wrapped in `RoleGuard requiredRole="tester"`; the account settings route itself is authenticated but not tester-role restricted.
- `/tester/privacy`, `/tester/security-history`, `/active-sessions`, `/support`, `/support/:id`, and `/withdrawal-request` are therefore reachable routes, not merely unused components.
- `supabase-v2.ts` still requires `VITE_TESTER_WORKFLOW_V2_ENABLED=true` and an initialized Supabase client; it selects schema `rebuild_v2`. The flag remains off by default.

CI recheck:
- Current branch head remains `7d844a6afb9224a68670530d441cc4650674caa1`; its combined Vercel status is failure with the `upgradeToPro=build-rate-limit` target.
- The latest inspected GitHub Actions job `132913259268` for run `43747281313` returned an empty steps array on a direct steps lookup as well as `steps: null` in the job summary. Thus `npm install`, `npm run typecheck`, and `npm run build` have still not been observed running.
- The exact platform-side reason for the pre-step job termination is not available in the returned metadata. No repository Actions settings or Vercel settings were changed.

Next implementation slice:
1. Add explicit V2 profile reads/updates for settings and language preferences, or document the profile table as intentionally shared (currently it is not shared in the candidate schema).
2. Implement V2 privacy export against V2 tables and `wallet_ledger`, with no invented rewards; distinguish unavailable export domains from empty data.
3. Decide whether support tickets are in this cutover; if yes, add V2 table access and a separately verified private Storage authorization flow before enabling attachment upload/download.
4. Provide V2-safe session/security activity RPCs or clearly mark those histories unavailable; do not call legacy RPCs as a fallback in V2 mode.
5. Keep referral features marked as not connected until their V2 data model/workflow is implemented.
6. Continue to keep withdrawals disabled in V2.

### Privacy & Data Management V2 export integration — 2026-11-15

Implemented on `rebuild/testdz-v2` only:

- `PrivacyDataManagementPage` now imports the guarded `supabaseV2` client and uses `rebuild_v2.profiles` for the account summary when the V2 flag is enabled. A profile query error is surfaced instead of silently showing fallback values.
- Full data export and activity CSV now select V2 data from `rebuild_v2.assignments`, `checkins`, `feedback`, `notifications`, and `wallet_ledger` when V2 is enabled. The legacy schema queries remain isolated to the legacy branch.
- V2 full export also includes the user's `rebuild_v2.wallets` summary (`earned_points`, `purchased_credits`, `updated_at`). V2 ledger entries are labelled `walletLedger`, not `pointsLedger`, and CSV rows are labelled `Ledger`; this avoids implying that all ledger entries are reward points.
- V2 export records its workflow version and a list of the included data domains. The feature flag remains default-off; no Production enablement occurred.
- Privacy preferences and export-request history continue to be stored in the signed-in user's Supabase Auth user metadata; no new database table or migration was introduced.
- No account deletion was added. The existing UI continues to state that deletion is not available from this screen and no data is deleted.

Verification limits:
- GitHub source read-back confirms the V2 schema branch and selected columns are present. The inspected V2 schema defines the selected profile, assignment, check-in, feedback, notification, wallet, and wallet-ledger columns; the security migration contains owner-scoped SELECT policies for these records.
- This is source/schema-contract verification only. No export was run against a live user account, no user data was written, and no TypeScript/build/CI pass is claimed.
- Privacy export is still a scoped export, not a complete archive of every possible account-related domain (for example, device/session/security events, support conversations, and payment/subscription records are not included in this pass). The UI copy should not be interpreted as a legal completeness certification.
- The latest CI blocker remains pre-step job termination; no repository Actions or Vercel settings were changed.

### Privacy export UI wording follow-up

- Updated the export descriptions to say they cover the available profile, tester activity, and wallet records rather than implying a complete archive of every account-related system. The code still explicitly lists the included domains in the JSON export.
- This is copy-only; no schema, data, Auth, Storage, or Production changes.


### Settings and account-security V2 integration — 2026-11-15

Implemented on the rebuild/testdz-v2 branch only:

- SettingsSecurityPage now reads and updates rebuild_v2.profiles for display name and locale when the V2 feature flag is enabled. Legacy public.profiles access remains confined to legacy mode.
- The Settings page's V2 data-export action now directs users to the V2-aware Privacy & Data Management export instead of running its legacy-only export queries.
- LanguageAppearancePage now reads and updates rebuild_v2.profiles.locale in V2 mode. Theme and regional display preferences remain in the signed-in user's Auth metadata; password, email, and MFA operations remain Supabase Auth operations.
- ActiveSessionsPage no longer calls the legacy get_my_active_sessions RPC in V2 mode. It explicitly reports the V2 session list as unavailable rather than showing an empty list as if no sessions exist.
- LoginActivitySecurityPage no longer calls the legacy get_my_security_activity RPC in V2 mode. The event count and table show an unavailable state rather than a misleading zero-event history.
- Supabase Auth signOut({ scope: "others" }) remains the supported Auth operation. The V2 session list itself is not yet implemented, so the page does not offer per-session inventory or claim that a session list was refreshed.

Verification limits:
- These are source-level integrations only. No browser session, TypeScript check, Vite build, or CI build pass has been completed.
- The V2 feature flag remains off by default. No SQL, migrations, Auth configuration, Storage, Production database, Vercel configuration, or PR #18 changes were made.
- V2 session inventory and login-event history remain explicit feature gaps until dedicated, owner-scoped V2 RPCs and contract tests are implemented.


### Support workflow V2 safety guard — 2026-11-15

- SupportCenterPage now skips legacy support-ticket reads in V2 mode, shows ticket counts as unavailable, and disables ticket creation. The V2 page does not present an empty legacy result as a real empty inbox.
- SupportTicketDetailsPage now skips legacy ticket/message/attachment queries in V2 mode and blocks reply, upload, and signed-URL actions. The V2 support workflow remains unavailable until the distinct V2 requester/attachment contract and private Storage authorization flow are implemented and tested.
- Legacy support behavior remains available when V2 is disabled.
- This is a frontend safety guard only. No support schema, Storage bucket, policies, migrations, or database records were changed. No build or browser verification is claimed.

### Referral pages V2 read-only integration — 2026-11-15

Implemented on `rebuild/testdz-v2` only:

- `ReferralProgramPage` now uses the V2 profile and notification schema when the V2 feature flag is enabled; legacy schema reads remain in legacy mode.
- `ReferralHistoryPage` now reads only rows where the signed-in user is `referrer_id` from `rebuild_v2.referrals`. The V2 referrals SELECT policy is participant-scoped (referrer/referred user) with an admin exception.
- The V2 history UI uses the actual V2 statuses (`pending`, `qualified`, `rewarded`, `rejected`) and displays a short opaque tester identifier rather than querying or exposing the referred user's email.
- Reward amounts, referral points, referral rank, and leaderboard values remain unavailable. The V2 referrals table does not itself define a reward amount, and this phase does not implement reward posting.
- Referral code creation, invitation-link generation, and referral writes remain disabled/not implemented. No insert/update/delete operation was added.
- Referral-history CSV output does not fabricate a reward amount; V2 rows export the reward amount as unavailable.
- The period filter is now applied to the visible referral history.

Verification limits:

- GitHub source read-back confirms the V2 schema-qualified read, referrer filter, V2 status handling, and unavailable reward copy. This is source-level verification only.
- No live user referral data was read, no SQL or migrations were executed, and no database, Auth, Storage, Production, Vercel, or PR #18 changes were made.
- TypeScript, Vite build, browser behavior, and CI build remain unverified. Do not treat this integration as production-ready or enable the V2 feature flag in Production based on this source review alone.

### Notification preferences profile read — 2026-11-15

- `NotificationPreferencesPage` now selects the profile through `rebuild_v2.profiles` when the V2 feature flag is enabled; legacy mode continues to use `public.profiles`.
- Notification preference values remain in the authenticated user's own Supabase Auth `user_metadata`; this change does not introduce a new database table or claim that notification delivery channels are active.
- Profile query errors now surface an unavailable/error state rather than silently presenting a fallback profile as successfully loaded.
- Source read-back confirmed the V2 schema branch and unchanged Auth metadata save path. No SQL, migrations, live account reads, or production changes were performed.


### Project-wide V2 integration scan — 2026-11-15

- Reviewed the remaining tester pages and shared identity/profile/app service modules for legacy Supabase reads, RPCs, Storage access, and V2 feature-flag handling.
- `CheckInHistoryPage` reads V2 check-ins with `evidence_path` only as internal row data; it explicitly sets `evidence_url: null` in V2 mode. The CSV therefore exports an empty Evidence URL, and the UI has no V2 signed-URL action. Dedicated check-in evidence registration and authorization remain unsupported.
- `TesterLeaderboardPage` loads only the current user's V2 profile/notification data and deliberately clears global ranking, ledger, tester-count, and award totals. It does not query legacy cross-user ranking data in V2 mode.
- `WithdrawalRequestPage` explicitly disables withdrawals in V2 mode and does not query the legacy wallet. `WithdrawalStatusPage` now selects the profile through `rebuild_v2` when V2 is enabled; legacy mode is unchanged.
- `SupportCenterPage` and `SupportTicketDetailsPage` both block legacy ticket/message/attachment reads in V2 mode. The latter also blocks legacy Storage signed URLs and all reply/upload actions.
- `PrivacyDataManagementPage` uses V2 profile, assignment, check-in, feedback, notification, wallet, and wallet-ledger queries for its V2 exports. Its export remains scoped to the listed domains and is not a complete account archive.
- `SettingsSecurityPage`, `LanguageAppearancePage`, `ActiveSessionsPage`, and `LoginActivitySecurityPage` retain the previously documented V2-specific profile/settings integration and explicit unavailable states for unsupported session/security-history features.
- Shared developer app/profile service modules (`features/apps/apps-api.ts`, `features/profiles/profiles-api.ts`) and `DeveloperDashboardPage` still use the legacy public-schema client. This scan treats developer workspace/app management as not migrated to the tester V2 workflow; it is not evidence that these modules are V2-compatible. Keep developer workflows on the legacy path until a separately reviewed migration is implemented.
- Shared identity role lookup remains through `public.user_roles`; this is the current application identity integration and was not changed in this scan. Its authorization boundary remains dependent on the reviewed legacy role-table policies and must be included in any future identity cutover review.

Verification:
- Source read-back was performed on `rebuild/testdz-v2`; the withdrawal-status change is committed separately and must be verified against the resulting branch HEAD.
- No database, Auth, Storage, Production, Vercel, or PR #18 changes were made. No TypeScript, Vite build, browser, or CI pass is claimed.
- The V2 feature flag remains off by default. Do not enable it in Production based on this source scan alone.
