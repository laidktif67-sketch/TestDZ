# V2 frontend cutover inventory

Date: 2026-11-16  
Branch: `rebuild/testdz-v2`  
Target: `rebuild_v2` for application Data API; `rebuild_v2_private` for unexposed internal routines.

## Architecture rule

- Auth session, sign-in, sign-out, OAuth, and Storage continue through the base Supabase client.
- Application table and RPC access must go through a single application Data API client.
- During migration only, the central selector preserves the existing `VITE_TESTER_WORKFLOW_V2_ENABLED` fallback. This is not the final architecture. The fallback is removed only after all routes are migrated and cutover is approved.
- No page may access `rebuild_v2_private` directly or expose it through PostgREST.

## Work completed in this pass

## Active assignment progress extraction (2026-11-16)

- Added `getActiveAssignmentProgressPageData(assignmentId, userId)` to `apps/web/src/features/tester/tester-api.ts` for the assignment, test/app, own check-ins, own feedback count, profile, unread notifications, and legacy own-assignment points read.
- `ActiveAssignmentProgressPage.tsx` now delegates initial page data reads and both V2 workflow actions (`start_assignment`, `submit_checkin` plus its follow-up check-in read) to `tester-api.ts`. The page no longer calls `.from()` or `.rpc()` directly.
- Removed live legacy leaderboard enumeration from the page/API path: it no longer queries all tester roles, other users' profiles, or their points ledgers. Rankings remain intentionally unavailable until a privacy-safe aggregate endpoint is implemented. The local development preview retains its static mock podium only.
- V2 check-in reads select only `id,checkin_date`; the legacy evidence URL field remains isolated to the legacy branch. V2 reward totals remain disabled/zero in this page; no reward posting was added.
- No database writes, schema changes, deployment, or Production changes were performed. Frontend CI for this extraction is pending verification.

## Assignment submission read extraction (2026-11-16)

- Added `getAssignmentSubmissionPageData(assignmentId, userId)` to `apps/web/src/features/tester/tester-api.ts`.
- `AssignmentSubmissionPage.tsx` now delegates its initial assignment, check-in, and feedback-count reads to that API for both the transitional V2 and legacy paths.
- The page retains the final-submission workflow, V2 RPC calls, and base-client Storage uploads. Those write/Storage operations were deliberately not moved as part of this read-only extraction.
- No reward posting, withdrawals, database changes, or deployment were performed.
- TypeScript/build CI for this new commit has not yet been verified.

## Latest tester history extraction (2026-11-16)

- Added `getCheckInHistoryPageData(userId)` and `getFeedbackHistoryPageData(userId)` to `apps/web/src/features/tester/tester-api.ts`.
- Migrated `CheckInHistoryPage.tsx` and `FeedbackHistoryPage.tsx` to consume those feature API functions. Both pages retain Auth/session access through the base client, but no longer issue page-level `.from()` or `.rpc()` data calls.
- Preserved the V2/legacy field differences inside the API module: V2 check-ins use private evidence paths and do not expose legacy evidence URLs or points-ledger values; V2 feedback history does not read the legacy `points_ledger`.
- This is an extraction only. It does not enable reward posting, withdrawals, or any database changes.
- The assignment progress and submission pages remain pending; they include workflow actions, Storage operations, and state transitions that require a separate contract-aware extraction.
- CI status for these three commits is pending verification; do not treat earlier passing CI as covering this change.


- Added `apps/web/src/lib/supabase-data.ts` with `getAppDataClient()` and `getSupabaseServiceClient()`.
- Routed app feature APIs, profile feature APIs, identity role retrieval, and the developer dashboard's profile read through the central Data API selector.
- Preserved base-client usage for Auth and Storage.
- Added `.github/workflows/frontend-ci.yml` to run `npm ci`, `npm run typecheck`, and `npm run build` on frontend/package changes.
- The first frontend CI run used the immediately preceding commit and exposed a return-type mismatch between SupabaseClient and the schema-scoped PostgREST client. The helper was corrected to return the common client as `any` to match the existing feature API typing. A run against the corrected commit is still required.

## Confirmed remaining migration inventory

The following pages still contain direct database access and/or explicit legacy fallback branches. They are not yet V2-only and must be migrated through feature API modules before removing the fallback:

### Tester workflow and activity
- `ActiveAssignmentProgressPage.tsx`: initial reads and V2 `start_assignment`/`submit_checkin` actions are centralized in `tester-api.ts`; no page-level `.from()`/`.rpc()` calls remain. Live cross-user leaderboard enumeration has been removed; rankings await a privacy-safe aggregate.
- `AssignmentSubmissionPage.tsx`: initial assignment/check-in/feedback reads are centralized in `tester-api.ts`; final submission RPC and base-client Storage uploads remain in the page pending a dedicated workflow extraction.
- `ActivityHistoryPage.tsx`: V2 path uses `wallet_ledger`; legacy path reads `points_ledger`.
- `CheckInHistoryPage.tsx`: page-level data calls are now extracted; schema-specific V2/legacy reads remain centralized in `tester-api.ts`.
- `DiscoverTestsPage.tsx`: V2 and public read branches; V2 uses `get_discoverable_tests`.
- `FeedbackHistoryPage.tsx`: page-level data calls are now extracted; V2 intentionally omits the legacy `points_ledger` read.
- `MyTestsPage.tsx`: V2 and public read branches for roles, profiles, wallets, assignments, feedback, notifications.
- `TesterDashboardPage.tsx`: V2 and public read branches for profile, wallet, assignments, tests, notifications.
- `TesterLeaderboardPage.tsx`: still performs client-side cross-user profile/role/ledger queries in the legacy branch; replace with a privacy-safe aggregate API before enabling.
- `WalletRewardsPage.tsx`: V2 reads `wallet_ledger`, public fallback reads `points_ledger`; no reward posting should be enabled.

### Support, notifications, profile export, referrals, withdrawal
- `NotificationsCenterPage.tsx`: V2 read-state RPCs exist, but legacy fallback still directly updates notification rows.
- `SupportCenterPage.tsx`: V2 support-ticket RPC and legacy direct insert fallback coexist.
- `SupportTicketDetailsPage.tsx`: V2 support message/attachment RPCs and legacy direct inserts coexist; Storage must remain on the base client.
- `PrivacyDataManagementPage.tsx`: V2/public export branches use different schema fields and ledger names; must be reconciled before cutover.
- `ReferralHistoryPage.tsx` and `ReferralProgramPage.tsx`: profile/notification data still uses a legacy-capable selector; referral workflow remains incomplete and must not imply reward posting.
- `WithdrawalStatusPage.tsx`: profile reads still use a legacy-capable selector; withdrawals remain preview-only.
- `WithdrawalRequestPage.tsx`: intentionally preview-only; it must not become a live withdrawal workflow as part of schema cleanup.

## Blocking compatibility decisions already established

- Canonical points/reward ledger is `rebuild_v2.wallet_ledger`; no client-side writes.
- Assignment dates and awarded points must use V2 schedule fields and server-owned ledger semantics.
- Check-in evidence must use private Storage paths and authorized access, not public evidence URLs.
- Leaderboard must use an opt-in privacy-safe aggregate and must not weaken RLS.
- Support writes and notification read-state changes must use V2 RPCs.
- Referral reward posting, payouts/withdrawals, and financial operations remain disabled until their server-side contracts and business rules are approved.
- Admin and staff workflows require their own complete UI/API contract; schema existence alone does not establish readiness.

## Next implementation order

1. Extract tester dashboard, discover tests, my tests, activity history, check-in history, feedback history, and active-assignment reads/actions into feature API modules (completed). Assignment submission initial reads are extracted; submission workflow actions remain pending.
2. Reconcile the points/date/evidence fields in those APIs against the actual V2 schema and tests.
3. Extract wallet, notification, and support APIs; remove page-level table/RPC calls.
4. Implement a dedicated privacy-safe leaderboard aggregate contract; cross-user client-side enumeration is now removed from the active-assignment page but remains to be checked in `TesterLeaderboardPage.tsx`.
5. Complete profile export and remaining read-only/referral display routes.
6. Add static source checks preventing direct page-level database access and legacy fallback references.
7. Only then remove the feature flag fallback and test the frontend against PostgREST with `rebuild_v2` exposed on an isolated environment.

## Verification status

- The existing isolated SQL CI run remains successful for 18 scripts and 9 SQL contracts.
- The new frontend CI workflow passed on commit `589fa2a8d2f69e4f2a208493fe4eb7fb7362d75e`: `npm ci`, TypeScript typecheck, and production build all succeeded. Workflow run: `43946437297`.
- No database writes, hosted schema changes, Vercel environment changes, deployments, PR #18 edits, or Production changes were made in this pass.
