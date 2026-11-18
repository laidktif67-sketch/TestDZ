# Developer Workspace Full Inventory and V2 Porting Audit

**Audit date:** 2026-11-18  
**Repository:** `laidktif67-sketch/TestDZ`  
**Reference legacy branch:** `feature/developer-full-lifecycle` at `b777236394bf3f8f81402a866fb7e062b6a5ad41`  
**Expanded legacy branch:** `feat/developer-create-test-six-step` at `e6a7f8ea27c0c2a4d2f49e6fe9565f23cf741b2b`  
**Current V2 integration reference:** PR #82 head `9d3b71ffe41a3cebbdce0928cf09dfc6fb9ac1bb`

## Executive finding

The previous five-page description understated the developer workspace. The expanded legacy branch contains **20 developer page files** (19 original lifecycle pages plus the six-step test-creation page), a dedicated developer sidebar, 20 page stylesheets, a dedicated route module, and feature APIs for apps, tests, testers, analytics, billing, feedback, notifications, and support.

The six-step branch is 45 commits ahead of the full-lifecycle branch and includes the six-step test creator. It is the better legacy UI reference. It is **not** a safe direct merge source for current V2: comparing the six-step commit with the current V2 integration head reports a divergent history (current V2 is 751 commits ahead and 941 behind that legacy ref in the GitHub comparison). Port behavior and design selectively against V2 contracts; do not merge or cherry-pick the legacy branch wholesale.

This is a repository-only audit. It does not change hosted Supabase, production data, secrets, Storage objects, deployments, or PR merge state.

## 1. Full legacy page inventory

Reference tree: `feat/developer-create-test-six-step`.

| Area | Page file | Legacy route / status |
|---|---|---|
| Workspace | `DeveloperDashboardPage.tsx` | `/developer-dashboard` |
| Apps | `DeveloperAppsPage.tsx` | `/apps` |
| Apps | `DeveloperAddAppPage.tsx` | `/apps/new` |
| Apps | `DeveloperAppDetailPage.tsx` | `/apps/:id` |
| Tests | `DeveloperCreateTestPage.tsx` | Legacy alternate; not mounted by the dedicated route array |
| Tests | `DeveloperCreateTestSixStepPage.tsx` | `/developer/tests/new`; six-step creator |
| Tests | `DeveloperMyTestsPage.tsx` | `/developer/tests` |
| Tests | `DeveloperTestCampaignDetailsPage.tsx` | `/developer/tests/:id` |
| Tests | `DeveloperTestMonitoringPage.tsx` | `/developer/tests/:id/monitoring` |
| Test operations | `DeveloperTestersPage.tsx` | `/developer/testers` |
| Test operations | `DeveloperTestResultsPage.tsx` | `/developer/results` |
| Insights | `DeveloperAnalyticsPage.tsx` | `/developer/analytics` |
| Feedback | `DeveloperFeedbackPage.tsx` | `/developer/feedback` |
| Feedback | `DeveloperFeedbackDetailsPage.tsx` | `/developer/feedback/:id` |
| Account | `DeveloperSubscriptionPage.tsx` | `/developer/subscription` |
| Account | `DeveloperSettingsPage.tsx` | `/developer/settings` |
| Notifications | `DeveloperNotificationsPage.tsx` | `/developer/notifications` |
| Help | `DeveloperHelpCenterPage.tsx` | `/developer/help` |
| Support | `DeveloperSupportCenterPage.tsx` | `/developer/support` |
| Support | `DeveloperSupportTicketDetailsPage.tsx` | `/developer/support/:id` |

Additional legacy shell files:
- `apps/web/src/modules/developer/components/DeveloperSidebar.tsx`
- `apps/web/src/modules/developer/components/developer-sidebar.css`
- One dedicated stylesheet per page in `apps/web/src/modules/developer/styles/`
- `apps/web/src/routes/developerRoutes.tsx` declares the 19 mounted route entries. The legacy alternate `DeveloperCreateTestPage.tsx` is not mounted; the six-step page replaces it at `/developer/tests/new`.

The separate branch `feat/developer-report-review` also contains `DeveloperReviewReportsPage.tsx`. This is an additional feature branch, not part of the 20-page six-step inventory and not automatically included in the lifecycle route set.

## 2. Current V2 route/page coverage

Current V2 reference: PR #82 head `9d3b71f...`.

| Legacy capability | Current V2 status | Finding |
|---|---|---|
| Developer dashboard | Present | `DeveloperDashboardPage` exists and uses V2-aware app APIs. |
| App list | Present outside developer module | `/apps` and `AppsPage` exist. |
| Add app | Restored in PR #84 | `/apps/new` now uses V2 `create_app`, app-limit and owner-scoped icon upload APIs. Draft-only; no legacy distribution RPC. |
| App details | Present outside developer module | `/apps/:id` and `AppDetailPage` exist. |
| Six-step test creation | Restored in PR #86; CI pending | `/developer/tests/new` ports the six-stage legacy flow to V2. The draft and allowlisted `test_config` are created atomically through `create_test_with_config`; CSV emails and Google Group addresses remain local and are not persisted. |
| My tests | Partial | Current `DeveloperTestsPage` lists and manages V2 tests; no separate full `DeveloperMyTestsPage`/campaign route. |
| Campaign details | Missing | V2 has cohort and test lifecycle APIs, but no dedicated developer campaign detail route/page. |
| Test monitoring | Missing | No developer monitoring route/page in V2. |
| Tester management | Missing | No V2 `DeveloperTestersPage` or equivalent developer-facing tester management API. |
| Test results | Missing | No V2 developer results page/API. |
| Analytics | Missing | No V2 developer analytics page or dedicated analytics API. |
| Feedback inbox | Present, partial | V2 `DeveloperFeedbackPage` exists; review and message APIs are present. |
| Feedback details | Partial/missing | No V2 detail page; current V2 API does not yet expose the complete legacy attachment/event detail workflow. |
| Subscription | Missing UI | V2 schema has plans, subscriptions and payments; no developer billing page/API. Payments/refunds are not an active provider workflow. |
| Settings | Missing dedicated page | Shared profile/identity facilities exist; no full developer settings surface. |
| Notifications | Present | V2 developer notifications page and role-aware read RPC path exist. |
| Help center | Missing | No dedicated V2 developer help page. |
| Support center/details | Missing developer-facing UI | V2 support queue/detail is staff-side. Support schema allows tester/developer requester roles, but current V2 support API surface does not provide the complete developer requester portal. |
| Report review | Separate Admin workflow | The report/dispute queues are role-scoped; no developer report-review page is mounted. |

V2 now includes the Dashboard, Add App, six-step Create Test, Tests, Feedback, Notifications, and Review Queue pages under `modules/developer/pages` (the Review Queue remains mounted under an Admin route). App list/detail pages remain outside the developer folder. The Review Queue is mounted under an Admin route, not a Developer route. App list/detail pages are outside the developer folder and are still part of the developer experience.

## 3. Data/API compatibility findings

### Legacy feature APIs

The six-step legacy branch uses the older public-schema API shape:
- Apps: `apps`, `tests`, `app-icons`; RPCs `get_app_limit`, `create_app`, `create_app_with_distribution`, `update_app`, `archive_app`, `restore_app`.
- Tests: `tests`, `assignments`, `feedback`, `cohort_tests`; several direct table reads/updates.
- Developer tester management: `tests`, `assignments`, `profiles`.
- Analytics: `tests`, `apps`, `assignments`, `feedback`.
- Billing: `plans`, `subscriptions`, `payments`, `apps`, `tests`, `assignments`.
- Feedback: `feedback`, `developer_feedback_reviews`, `developer_feedback_messages`, `developer_feedback_attachments`, `developer_feedback_events`, and a legacy Storage bucket. Some review/message/attachment metadata operations are direct client writes.
- Notifications: `notifications` plus tester-oriented related data.
- Support: `support_tickets`, `support_ticket_messages`, `support_ticket_attachments`, `support_ticket_events`, and the legacy `support-attachments` bucket. Legacy client flow inserts messages/attachment metadata directly and uploads before registering metadata.

### Current V2 facilities

V2 already provides a stronger foundation for important parts of the workspace:
- `apps-api.ts` uses the V2-aware data client, `rebuild_v2` RPCs and V2 Storage paths for app/test lifecycle. It exposes app list/create/update/archive/restore; test create/update/content save/review submission; cohort create/list/update/transition; private test-build and test-asset registration/finalization; developer feedback list/review/messages; and Admin app/test review.
- V2 SQL `008_developer_lifecycle.sql` owns test creation and cohort creation boundaries.
- V2 SQL `012_cohort_management.sql` owns audited cohort management.
- V2 SQL `016_private_developer_feedback.sql` provides protected developer feedback review/message RPCs.
- V2 support API uses `create_support_ticket`, `send_support_message`, `add_support_attachment`, and `update_support_ticket`, rather than the legacy direct-write model. The support workflow is audited in candidate migration `024_audited_support_ticket_workflow.sql`.
- V2 notification reads/updates are role-aware; the developer recipient role is explicit and V2 mark-read operations use RPCs.
- V2 schema includes `plans`, `subscriptions`, `payments`, `refunds`, and support/feedback records. Their presence is not proof of an operational payment provider or a developer billing workflow.

### Security/compatibility rules for porting

1. Do not copy the legacy API modules unchanged. Their unqualified public table names and direct-write patterns are not equivalent to the V2 `rebuild_v2` schema and RPC boundaries.
2. Preserve V2 backend authority for app/test lifecycle, review submission, cohort transitions, test-build and test-asset registration/finalization, feedback review/messages, and support messages.
3. Do not reintroduce client-side direct writes to feedback review/message/attachment records or support ticket/message/attachment records.
4. Do not restore the legacy upload-first support attachment flow. V2 requires trusted metadata/path validation and public-message-only visibility for Support attachment access.
5. Analytics, tester management, test monitoring and test results need explicit V2 query/API contracts and RLS verification before pages are enabled.
6. Billing can initially be read-only. Do not add checkout, payment confirmation, subscription activation, refund approval, or wallet credit behavior without a verified provider and audited server-side workflow.
7. Keep test CSV email parsing as local draft configuration only unless a separate, consented invitation workflow is designed. Parsing a CSV must not silently invite or disclose tester email addresses.
8. The V2 six-step wizard now persists its validated configuration through candidate migration `029_six_step_test_config.sql`. The RPC accepts only explicit keys/enums and creates the test draft and configuration in one transaction. Raw CSV email addresses and Google Group email addresses are excluded; invitation delivery remains a separate future workflow. The six-step wizard is under exact-head CI and still requires visual QA.

## 4. Recommended V2 port sequence

1. **Developer shell and route completeness:** the app creation and six-step test creation slices are restored in PRs #84 and #86. Remaining route work: test detail/monitoring, testers, results, analytics, feedback details, settings, subscription, help and support. Each route must be guarded by the persisted Developer role; app and test resources must still be owner-scoped in the backend.
2. **App creation:** implemented in PR #84 with the existing V2 `create_app` and app-icon upload contract. No legacy `create_app_with_distribution` RPC.
3. **Six-step test creation:** implemented in PR #86 using the V2 test API and atomic allowlisted config RPC; exact-head CI and visual QA are pending.
4. **Test operations:** define owner-scoped V2 APIs for campaign/test details, cohort/assignment monitoring, tester profile minimization, and result/feedback aggregation. Do not expose tester private profile fields or unrelated assignments.
5. **Feedback details:** add the V2 detail page against existing feedback/message/review RPCs; add attachment/event reads and writes only after their exact RLS, Storage and audit contracts are verified.
6. **Account:** restore settings through shared profile/identity APIs. Subscription page is initially read-only and must state that payments are not processed until provider integration exists.
7. **Developer support portal:** add developer-owned ticket list/create/detail/reply using V2 support RPCs and requester role `developer`; retain public/internal-note separation and V2 attachment metadata boundary.
8. **Verification:** add contract tests for Developer-only ownership boundaries and cross-role denials, then run isolated local SQL replay, frontend typecheck/build and existing CI against the exact final commit. Manual desktop/mobile/RTL QA follows. No Vercel Preview unless a complete UI slice needs visual review.

## 5. Not in scope / safety gates

- No wholesale merge/cherry-pick of legacy feature branches.
- No hosted Supabase migration, data write, Storage deletion, Auth mutation, secret change or Edge deployment.
- No payment, refund, payout, wallet-credit or subscription activation implementation without a verified provider/business policy and audited server execution.
- No Vercel Preview on every incremental change; only a completed visual slice may justify one.
- All resulting PRs remain Draft/unmerged until the user explicitly approves the merge.

## 6. Source references

- Legacy full workspace: `feature/developer-full-lifecycle` at `b777236394bf3f8f81402a866fb7e062b6a5ad41`.
- Six-step creator and expanded routes: `feat/developer-create-test-six-step` at `e6a7f8ea27c0c2a4d2f49e6fe9565f23cf741b2b`.
- Separate developer report review: `feat/developer-report-review` at `48e73136c37bf4e15ba9aa38256a207e1d4f3cc4`.
- Current V2 integration reference: PR #82 at `9d3b71ffe41a3cebbdce0928cf09dfc6fb9ac1bb`.
- V2 candidate SQL: `001_schema.sql`, `002_security.sql`, `008_developer_lifecycle.sql`, `012_cohort_management.sql`, `016_private_developer_feedback.sql`, and `024_audited_support_ticket_workflow.sql`.
