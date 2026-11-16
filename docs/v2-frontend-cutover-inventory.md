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

## Support page API extraction (2026-11-16)

- Added feature API functions for listing/creating the signed-in user's support tickets, loading ticket/conversation/attachment metadata, sending replies, and registering attachment metadata.
- `SupportCenterPage.tsx` and `SupportTicketDetailsPage.tsx` no longer perform direct table/RPC operations. File byte upload and signed URL creation remain on the base Supabase Storage client by design.
- V2 support mutations continue to use the existing guarded RPCs; legacy inserts remain isolated inside the API module for the transition only.
- No support data, schema, Storage objects, or hosted project settings were modified. Frontend CI is required for verification.

## Wallet and notifications API extraction (2026-11-16)

- Added `getWalletRewardsPageData` to `tester-api.ts`; `WalletRewardsPage.tsx` no longer queries tables directly. V2 now reads only profile and unread-notification metadata: it does not read `wallets`, `wallet_ledger`, earned points, or purchased credits while reward/payment rules remain disabled. Legacy wallet/points reads remain isolated in the API fallback.
- Added notification-center read and read-state operations to `tester-api.ts`. `NotificationsCenterPage.tsx` no longer performs page-level table or RPC calls; V2 read-state changes use the guarded RPCs and legacy updates remain isolated in the API module.
- No wallet posting, purchases, reward redemption, withdrawals, database changes, or deployments were introduced.
- Frontend CI must pass on the latest commit before these extractions are considered verified.

## Tester reward-read cleanup (2026-11-16)

- Extended the reward-disabled behavior to the Discover Tests and Activity History APIs: V2 no longer reads `wallets.earned_points` or enumerates `wallet_ledger` for these screens while reward posting remains disabled.
- The API preserves stable empty-result shapes so existing UI states continue to render the already-labeled unavailable reward values; legacy reads remain isolated to the transitional fallback.
- No changes to wallet schema, ledger entries, reward posting, withdrawals, or any hosted database were made.
- Frontend CI/typecheck/build remains required for the latest commits.

## Tester dashboard and My Tests reward gating (2026-11-16)

- Reviewed the V2 data paths for `TesterDashboardPage.tsx` and `MyTestsPage.tsx`.
- V2 dashboard and My Tests no longer read the materialized wallet balance while reward posting remains disabled. The dashboard's points milestone is hidden in V2, and its points statistic remains unavailable; the legacy fallback retains its existing balance read for the transitional period.
- Role, profile, assignment, feedback, and notification reads remain routed through `tester-api.ts`; Auth session access remains on the base Supabase client.
- No reward posting, wallet writes, schema changes, hosted database changes, environment changes, or deployment were introduced.
- Frontend typecheck/build must be verified by GitHub Actions for this change before treating it as complete.


## Assignment submission workflow extraction (2026-11-16)

- Added feature API operations for checking an existing submission, creating the server-managed draft, listing/registering attachment metadata, and finalizing the submission.
- `AssignmentSubmissionPage.tsx` now calls those operations through `tester-api.ts`; the page retains only binary upload and signed-object existence checks through Supabase Storage.
- The finalization RPC is still invoked only after the upload loop completes. No business-rule changes, schema changes, or reward posting were introduced.
- Frontend CI/build for this extraction is pending verification.

## Active assignment progress extraction (2026-11-16)

- Added `getActiveAssignmentProgressPageData(assignmentId, userId)` to `apps/web/src/features/tester/tester-api.ts` for the assignment, test/app, own check-ins, own feedback count, profile, unread notifications, and legacy own-assignment points read.
- `ActiveAssignmentProgressPage.tsx` now delegates initial page data reads and both V2 workflow actions (`start_assignment`, `submit_checkin` plus its follow-up check-in read) to `tester-api.ts`. The page no longer calls `.from()` or `.rpc()` directly.
- Removed live legacy leaderboard enumeration from the page/API path: it no longer queries all tester roles, other users' profiles, or their points ledgers. Rankings remain intentionally unavailable until a privacy-safe aggregate endpoint is implemented. The local development preview retains its static mock podium only.
- V2 check-in reads select only `id,checkin_date`; the legacy evidence URL field remains isolated to the legacy branch. V2 reward totals remain disabled/zero in this page; no reward posting was added.
- No schema changes, hosted database writes, deployment, or Production changes were performed. The page's existing start/check-in actions still perform their intended workflow RPCs at runtime. Frontend CI for this extraction is pending verification.

## Assignment submission read extraction (2026-11-16)

- Added `getAssignmentSubmissionPageData(assignmentId, userId)` to `apps/web/src/features/tester/tester-api.ts`.
- `AssignmentSubmissionPage.tsx` now delegates its initial assignment, check-in, and feedback-count reads to that API for both the transitional V2 and legacy paths.
- The page now routes V2 submission lifecycle RPCs and attachment metadata queries through `tester-api.ts`. It retains only binary upload and signed-object existence checks through the base Supabase Storage client.
- No reward posting, withdrawals, schema changes, hosted database changes, or deployment were performed.
- TypeScript/build CI for this new commit has not yet been verified.

## Latest tester history extraction (2026-11-16)

- Added `getCheckInHistoryPageData(userId)` and `getFeedbackHistoryPageData(userId)` to `apps/web/src/features/tester/tester-api.ts`.
- Migrated `CheckInHistoryPage.tsx` and `FeedbackHistoryPage.tsx` to consume those feature API functions. Both pages retain Auth/session access through the base client, but no longer issue page-level `.from()` or `.rpc()` data calls.
- Preserved the V2/legacy field differences inside the API module: V2 check-ins use private evidence paths and do not expose legacy evidence URLs or points-ledger values; V2 feedback history does not read the legacy `points_ledger`.
- This is an extraction only. It does not enable reward posting, withdrawals, or any database changes.
- Assignment progress and submission initial reads are now extracted; their workflow actions have also been moved into feature APIs. Binary Storage operations remain page-level by design.
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
- `AssignmentSubmissionPage.tsx`: initial reads and V2 submission lifecycle RPCs/attachment metadata operations are centralized in `tester-api.ts`; only binary upload and signed-object checks remain in the page through the base Storage client.
- `ActivityHistoryPage.tsx`: V2 path does not read reward ledgers while rewards are disabled; legacy path reads `points_ledger`.
- `CheckInHistoryPage.tsx`: page-level data calls are now extracted; schema-specific V2/legacy reads remain centralized in `tester-api.ts`.
- `DiscoverTestsPage.tsx`: V2 and public read branches; V2 uses `get_discoverable_tests`.
- `FeedbackHistoryPage.tsx`: page-level data calls are now extracted; V2 intentionally omits the legacy `points_ledger` read.
- `MyTestsPage.tsx`: V2 reads roles, profiles, assignments, feedback, and notifications; wallet reads are legacy-only while rewards are disabled.
- `TesterDashboardPage.tsx`: V2 reads profile, assignments, discoverable tests, and notifications; wallet reads are legacy-only while rewards are disabled.
- `TesterLeaderboardPage.tsx`: personal profile/notification shell reads are centralized in `getTesterLeaderboardPageData`; cross-user profile/role/ledger enumeration has been removed from both V2 and legacy paths. Rankings and period filters remain unavailable until a privacy-safe aggregate API is designed and approved.
- `WalletRewardsPage.tsx`: data access is centralized in `tester-api.ts`; V2 does not read wallet balances, purchased credits, or reward ledgers while reward/payment rules remain disabled. Legacy reads are transitional only.

### Support, notifications, profile export, referrals, withdrawal
- `NotificationsCenterPage.tsx`: reads and read-state changes are centralized in `tester-api.ts`; V2 uses guarded read-state RPCs.
- `SupportCenterPage.tsx`: ticket listing and creation are centralized in `tester-api.ts`; V2 creation uses the guarded RPC.
- `SupportTicketDetailsPage.tsx`: ticket/conversation reads, replies, and attachment metadata registration are centralized in `tester-api.ts`; binary uploads and signed URL access remain on base Supabase Storage.
- `PrivacyDataManagementPage.tsx`: V2/public export branches use different schema fields and ledger names; must be reconciled before cutover.
- `ReferralHistoryPage.tsx` and `ReferralProgramPage.tsx`: profile/notification data still uses a legacy-capable selector; referral workflow remains incomplete and must not imply reward posting.
- `WithdrawalStatusPage.tsx`: profile reads still use a legacy-capable selector; withdrawals remain preview-only.
- `WithdrawalRequestPage.tsx`: intentionally preview-only; it must not become a live withdrawal workflow as part of schema cleanup.

## Blocking compatibility decisions already established

- Canonical points/reward ledger is `rebuild_v2.wallet_ledger`; no client-side writes.
- Assignment dates and awarded points must use V2 schedule fields and server-owned ledger semantics.
- Check-in evidence must use private Storage paths and authorized access, not public evidence URLs.
- Leaderboard must use an opt-in privacy-safe aggregate and must not weaken RLS. Until that service exists, the page intentionally shows no global rankings or aggregate totals.
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
