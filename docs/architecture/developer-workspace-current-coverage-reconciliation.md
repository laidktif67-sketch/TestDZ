# Developer Workspace — Current V2 Coverage Reconciliation

**Audit date:** 2026-11-18  
**Repository:** `laidktif67-sketch/TestDZ`  
**Audited head:** `8d79d3154efe6284a8d91dbaeca7b5690e469758` (PR #107 head)  
**Scope:** repository-only route, page, API and prior-inventory reconciliation.

## Why this document exists

The full legacy inventory in PR #83 correctly identified 20 legacy Developer page files and the initial V2 gaps at the PR #82 baseline. That inventory predates the later Developer implementation stack (#84–#107). It must not be read as a current list of missing pages. This reconciliation compares the old gap list with the current integrated Developer branch and the actual route registration in `apps/web/src/App.tsx`.

This is a documentation-only audit. It does not modify application behavior, SQL, migrations, hosted Supabase, Auth, Storage, secrets, Edge Functions, or deployments.

## Current mounted Developer routes

All routes below are nested under `RoleGuard requiredRole="developer"` in `apps/web/src/App.tsx` at the audited head.

| Capability | Mounted route | Current implementation |
|---|---|---|
| Developer dashboard | `/developer-dashboard` | `DeveloperDashboardPage` |
| App list | `/apps` | Shared `AppsPage` |
| Add app | `/apps/new` | `DeveloperAddAppPage` |
| App details | `/apps/:id` | Shared `AppDetailPage` |
| Test list / lifecycle | `/developer-tests` | `DeveloperTestsPage` |
| Six-step test creation | `/developer/tests/new` | `DeveloperCreateTestSixStepPage` |
| Test monitoring | `/developer/tests/:id/monitoring` | `DeveloperTestMonitoringPage` |
| Tester management | `/developer/testers` | `DeveloperTestersPage` |
| Test results | `/developer-test-results` | `DeveloperTestResultsPage` |
| Analytics | `/developer-analytics` | `DeveloperAnalyticsPage` |
| Feedback inbox and details | `/developer-feedback` | `DeveloperFeedbackPage` (list + selected-detail pane) |
| Notifications | `/developer-notifications` | `DeveloperNotificationsPage` |
| Help | `/developer-help` | `DeveloperHelpPage` |
| Developer support portal | `/developer-support` | Shared `SupportCenterPage workspaceRole="developer"` |
| Workspace settings | `/developer-settings` | `DeveloperWorkspaceSettingsPage` |

The legacy inventory's “feedback details missing” finding is superseded: the current feedback page already loads a selected feedback record, its messages, review status, priority, resolution note and private notes. It is not a separate URL, but the detail capability is present.

The Developer review queue is intentionally not a Developer route. `/admin/developer-reviews` is mounted under the Admin guard and is for Admin review of Developer role requests.

## Reconciled capability status

| Legacy capability | Current V2 status | Remaining qualification |
|---|---|---|
| Dashboard | Implemented | Verify mobile/desktop/RTL presentation manually. |
| Apps list / create / detail | Implemented | Uses V2 app APIs and icon lifecycle; confirm real signed-in owner flow in browser. |
| Six-step test creation | Implemented | Candidate config migration and contract exist; retain CSV email input as local draft only. |
| My tests / campaign management | Implemented in consolidated page | There is no separate legacy campaign-details URL; confirm every useful legacy field has a V2 destination. |
| Monitoring | Implemented | Privacy-safe aggregate RPC; confirm date/window and empty-state behavior visually. |
| Tester management | Implemented | Verify returned fields remain minimized and owner-scoped. |
| Test results | Implemented | Verify empty/loading/error states and data boundaries. |
| Analytics | Implemented | Uses monitoring summary data; do not describe aggregates as per-tester tracking. |
| Feedback inbox/details | Implemented in one page | Uses owner-scoped feedback RPCs, review RPC, message RPCs; attachments/events are not assumed available. |
| Subscription / billing | Schema and read-only workspace summary only | No checkout, payment provider execution, webhook verification, renewal, cancellation, refund or billing portal. Prices remain draft metadata. |
| Account profile/security | Shared Settings page exists | Email/password, MFA, sessions and privacy controls live in shared account settings, not a duplicate Developer-only identity system. |
| Developer workspace settings | Implemented | Read-only plan/usage and browser-local workspace language; not a billing mutation surface. |
| Notifications | Implemented | Role-aware Developer notification route and read flow. |
| Help | Implemented | Confirm support links and localization manually. |
| Developer support | Implemented intake path | PR #102 adds role-explicit ticket creation; PR #103 onward includes it. Confirm requester list/detail/reply flow and attachments in browser; do not infer email delivery. |
| Invitations | Implemented as candidate workflow | PR #105; requires server secret before deployment and has no email provider. Link is prepared for manual sharing; not emailed. |
| Google Play publishing | Readiness audit only | PR #106 documents missing OAuth/service-account/API/job integration. No publishing API calls exist. |
| Developer report review | Not a Developer capability | Report queue is staff-side; no developer access to private reports should be inferred. |

## Implementation and audit trail by PR

The current Developer stack includes these relevant PRs:

- #82: Admin workspace and initial role/workspace coverage baseline.
- #83: Full legacy Developer inventory (20 page files, 19 mounted legacy routes) and safe V2 port plan.
- #84: V2 Developer app creation page.
- #85: V2 Developer test creation groundwork.
- #86: Six-step test wizard and candidate contract.
- #95: Privacy-safe test monitoring, tester/results/help capabilities and aggregate API.
- #101: Developer workspace settings.
- #102: Role-explicit Developer support intake.
- #103: Share links and privacy-safe analytics.
- #105: Secure Tester invitations and redemption.
- #106: Google Play integration readiness audit.
- #107: Billing and profile settings readiness audit.

PR #83 is a sibling documentation branch based on PR #82; its audit is not automatically included in the #86–#107 implementation stack. This document carries forward the useful inventory findings without cherry-picking or merging the sibling branch.

## Remaining work before calling Developer complete

1. **Inventory and field parity:** compare every useful field and action in the 20 legacy pages against the current V2 pages and APIs. Preserve useful inputs; record fields with no safe V2 destination as explicit product/schema decisions rather than silently dropping them.
2. **End-to-end browser verification:** sign in as a real Developer account and exercise app create/edit/archive/restore; six-step draft/review; monitoring; tester list; results; analytics; feedback review/private notes; notifications; support intake and ticket follow-up; settings.
3. **Privacy and authorization review:** verify cross-developer denial for app/test/feedback/invitation resources; ensure no tester private identity, unrelated assignment data, internal support notes, or financial data leaks into Developer pages.
4. **Visual QA:** desktop, mobile, Arabic RTL, keyboard navigation, focus, contrast, loading/empty/error states and narrow-screen tables.
5. **Billing policy decision:** define past-due grace period, downgrade behavior and final commercial pricing before enabling any checkout or plan mutation.
6. **Provider integration:** separately design and approve payment-provider onboarding, server-side checkout, signed webhooks, idempotent renewals, cancellation/refunds and reconciliation. Do not activate from schema presence alone.
7. **Google Play integration:** separately approve the Google account/project, API access, service-account/OAuth model, server-only credentials, release job lifecycle and staged rollout controls.
8. **Release gates:** run exact-head local disposable database contracts, frontend typecheck/build and TestDZ CI after implementation changes. Manual browser QA remains required. Do not consume Vercel deploy quota for incremental documentation or code-only checks.

## Safety boundary

- All PRs remain Draft and unmerged until the user explicitly approves merging.
- No hosted Supabase migration or data mutation, Storage/Auth changes, secrets, Edge deployment, cron, Vercel Preview or Production deployment is authorized by this audit.
- Do not merge the legacy Developer branches wholesale.
- Do not implement payment/refund/payout actions or Google Play publishing as UI-only client operations.
- Preserve existing useful fields and data contracts; no destructive cleanup is part of this work.
