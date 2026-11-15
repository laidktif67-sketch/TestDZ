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
