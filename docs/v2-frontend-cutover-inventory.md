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

- Added `apps/web/src/lib/supabase-data.ts` with `getAppDataClient()` and `getSupabaseServiceClient()`.
- Routed app feature APIs, profile feature APIs, identity role retrieval, and the developer dashboard's profile read through the central Data API selector.
- Preserved base-client usage for Auth and Storage.
- Added `.github/workflows/frontend-ci.yml` to run `npm ci`, `npm run typecheck`, and `npm run build` on frontend/package changes.
- The first frontend CI run used the immediately preceding commit and exposed a return-type mismatch between SupabaseClient and the schema-scoped PostgREST client. The helper was corrected to return the common client as `any` to match the existing feature API typing. A run against the corrected commit is still required.

## Confirmed remaining migration inventory

The following pages still contain direct database access and/or explicit legacy fallback branches. They are not yet V2-only and must be migrated through feature API modules before removing the fallback:

### Tester workflow and activity
- `ActiveAssignmentProgressPage.tsx`: V2 and legacy reads; legacy path uses `points_ledger`, `assignments.start_date`, and `checkins.evidence_url`; V2 path has `wallet_ledger`-era semantics but leaderboard data is still loaded from cross-user sources.
- `AssignmentSubmissionPage.tsx`: V2 submission RPC path exists, but initial reads still branch between V2 and public.
- `ActivityHistoryPage.tsx`: V2 path uses `wallet_ledger`; legacy path reads `points_ledger`.
- `CheckInHistoryPage.tsx`: V2 and legacy read branches; legacy reads `points_ledger`.
- `DiscoverTestsPage.tsx`: V2 and public read branches; V2 uses `get_discoverable_tests`.
- `FeedbackHistoryPage.tsx`: V2 and public read branches; points ledger field contract differs.
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

1. Extract tester dashboard, discover tests, my tests, assignment progress/submission, check-in history, and activity history into feature API modules.
2. Reconcile the points/date/evidence fields in those APIs against the actual V2 schema and tests.
3. Extract wallet, notification, and support APIs; remove page-level table/RPC calls.
4. Replace leaderboard cross-user enumeration with a dedicated privacy-safe aggregate contract.
5. Complete profile export and remaining read-only/referral display routes.
6. Add static source checks preventing direct page-level database access and legacy fallback references.
7. Only then remove the feature flag fallback and test the frontend against PostgREST with `rebuild_v2` exposed on an isolated environment.

## Verification status

- The existing isolated SQL CI run remains successful for 18 scripts and 9 SQL contracts.
- The new frontend CI workflow passed on commit `589fa2a8d2f69e4f2a208493fe4eb7fb7362d75e`: `npm ci`, TypeScript typecheck, and production build all succeeded. Workflow run: `43946437297`.
- No database writes, hosted schema changes, Vercel environment changes, deployments, PR #18 edits, or Production changes were made in this pass.
