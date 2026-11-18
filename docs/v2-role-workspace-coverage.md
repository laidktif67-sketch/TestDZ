# TestDZ V2 role and workspace coverage

This document inventories the current V2 role model and the application entry points. It is a review aid, not a grant of access. Database authorization and server-side checks remain authoritative.

## Persisted roles

The current `rebuild_v2.user_roles.role` constraint and `AccountRole` TypeScript union agree on five persisted roles:

| Role | Workspace | Current access |
|---|---|---|
| `tester` | Tester | Test discovery, assignments, check-ins, submissions, feedback, history, profile and tester support pages |
| `developer` | Developer | Developer dashboard, app management, test authoring, feedback and notifications |
| `admin` | Administration | Admin control center, user directory, role requests/grants, developer review, audit log, fraud summary and case oversight; Admin is also allowed through role guards for other workspaces |
| `financial` | Financial | Financial Operations and dispute queue; financial page is read-only, with no refund execution or payout |
| `support` | Support | Support ticket queue/details, public replies, reason-required ticket status/priority changes, and report queue metadata |

The onboarding choice `both` is not a persisted role. The UI translates it into `tester` + `developer` in the onboarding request. The trusted onboarding RPC establishes the baseline Tester role and creates a Developer role request when Developer access has not already been approved. Admin review is required before the Developer role is granted.

`guest` is an unauthenticated visitor state, not a row in `user_roles`. It is limited to public landing/legal/authentication routes.

Role provisioning rules:
- New accounts receive the baseline `tester` role through the trusted Auth-user trigger.
- Developer access is requested through onboarding and granted only after Admin review; selecting `both` does not bypass that approval.
- Admin can grant `tester`, `developer`, `financial` or `support` to another account with a mandatory audit reason through the Admin role-grant RPC.
- The client-facing role-grant RPC explicitly excludes `admin`; Admin must be bootstrapped through a trusted operator/backend process, never public registration or self-grant.


No `moderator` role is present in the current V2 SQL role constraint or the shared `AccountRole` union. Do not add it as a label or grantable role until its authority, data scope, escalation path and audit requirements are defined. Search legacy/archived code separately before declaring the entire repository free of historical Moderator references.

## Route inventory

### Tester
- Main: `/tester-dashboard`, `/my-tests`, `/discover-tests`, `/tests/:id`, `/leaderboard`.
- Assignment lifecycle: `/assignments/:id`, `/progress`, `/submit`, `/summary`, `/reward`.
- Activity: check-in history, activity history, feedback history, referral program/history.
- Account: profile, settings, notification preferences, language/appearance, privacy, sessions/security history.
- Rewards: wallet/rewards and withdrawal request/status pages. V2 payout is not enabled; do not present the legacy preview as a live payout.
- Help: support center, ticket details, live chat, report-problem page. Report submission remains disabled until the intake/evidence registration workflow is completed.

### Developer
- Main: `/developer-dashboard`, `/apps`, `/apps/:id`, `/developer-tests`, `/developer-feedback`, `/developer-notifications`.
- Developer role is not self-granted; onboarding requests it and Admin approval grants it.
- `/admin/developer-reviews` is an Admin review queue, not a Developer route.

### Administration
- `/admin` is the dedicated Admin control center.
- `/admin/users`, `/admin/role-requests`, `/admin/developer-reviews`, `/admin/audit-log`, `/admin/fraud-reviews`, `/admin/cases`.
- Admin can navigate into Financial and Support workspaces through the current Admin override in `RoleGuard`; this does not bypass database RLS or RPC authorization.

### Financial
- `/financial-operations`: payments, refunds and wallet ledger read-only view.
- `/financial-operations/disputes`: dispute metadata queue.
- Refund approval/execution, provider calls, bank return and wallet credit are not implemented. Do not turn these screens into action workflows until provider/legal policy and audited processing contracts are approved.

### Support
- `/support-workspace`, `/support-workspace/:id`, `/support-workspace/reports`.
- Ticket details expose public conversation only. Internal notes and their attachments must remain excluded from Support attachment metadata and Storage reads.
- Support has no cross-user wallet/payment/refund access.

### Public / Guest
- Landing, legal pages, signup/login, verification, password recovery and callback routes.
- Authenticated profile/onboarding routes are separate from public guest routes.

## Module/file inventory

- `apps/web/src/modules/tester/`: Tester pages, sidebar, styles.
- `apps/web/src/modules/developer/`: Developer pages and styles.
- `apps/web/src/modules/admin/`: Admin pages and styles.
- `apps/web/src/modules/support/`: Support queue and ticket detail pages.
- `apps/web/src/features/identity/` and `apps/web/src/shared/auth/`: identity loading, role lookup and shared auth state.
- `apps/web/src/shared/guards/RoleGuard.tsx`: route-level role guard and role-home selection.
- `packages/types/src/identity.ts`: shared TypeScript role union.
- `supabase/rebuild-v2/001_schema.sql`: persisted role constraint.
- `supabase/rebuild-v2/002_security.sql` and later role-specific scripts: server-side role helpers, RLS and privileged RPCs.

## Coverage gaps to keep visible

1. Legacy `public` workflow and V2 `rebuild_v2` workflow are feature-flagged separately. Audit each API for both modes; do not assume a V2 page implies a V2 backend path.
2. Tester pages for rewards/withdrawals still have legacy or preview-only behavior; V2 payout is disabled.
3. Report intake and evidence registration are not enabled. The Report Problem UI is a non-submitting placeholder.
4. Fraud review is read-only; no trusted ingestion or decision workflow.
5. Dispute queue is read-only; no investigation transition/history RPC.
6. Financial Operations is read-only; no refund approval, provider execution, bank return or wallet-credit workflow.
7. Support assignment management, internal notes, attachment review/download and notifications require separate privacy and workflow contracts. The current attachment work only permits public-message attachments.
8. Role switching/navigation must be reviewed independently of backend authorization. The Admin home now routes to the Admin control center instead of the Tester dashboard.

## Concrete page-file inventory

Counts below refer to `.tsx` page files in each role module at this PR stack, not to every route or shared component.

- Tester module — 33 page files:
  `ActiveAssignmentProgressPage`, `ActiveSessionsPage`, `ActivityHistoryPage`, `AssignmentDetailsPage`, `AssignmentSubmissionPage`, `CheckInHistoryPage`, `DiscoverTestsPage`, `FeedbackHistoryPage`, `HelpSupportPage`, `LanguageAppearancePage`, `LiveChatPage`, `LoginActivitySecurityPage`, `MyTestsPage`, `NotificationPreferencesPage`, `NotificationsCenterPage`, `PrivacyDataManagementPage`, `ReferralHistoryPage`, `ReferralProgramPage`, `ReportProblemPage`, `SettingsSecurityPage`, `SubmitFeedbackPage`, `SupportCenterPage`, `SupportTicketDetailsPage`, `TestCompletionRewardPage`, `TestCompletionSummaryPage`, `TestPreviewPage`, `TesterDashboardPage`, `TesterLeaderboardPage`, `TesterProfilePage`, `TesterSectionPage`, `WalletRewardsPage`, `WithdrawalRequestPage`, `WithdrawalStatusPage`.
- Developer module — 5 page files:
  `DeveloperDashboardPage`, `DeveloperFeedbackPage`, `DeveloperNotificationsPage`, `DeveloperReviewQueuePage`, `DeveloperTestsPage`. The review queue is mounted under an Admin-only route.
- Admin module — 7 page files after this PR:
  `AdminDashboardPage`, `AdminAuditLogPage`, `AdminFraudReviewsPage`, `AdminRoleRequestsPage`, `AdminUsersPage`, `CaseQueuesPage`, `FinancialOperationsPage`.
- Support module — 2 page files:
  `SupportQueuePage`, `SupportTicketDetailPage`.

Shared route/identity files that govern these modules:
- `apps/web/src/App.tsx`
- `apps/web/src/shared/guards/RoleGuard.tsx`
- `apps/web/src/shared/auth/identity-provider.tsx`
- `apps/web/src/shared/auth/identity-api.ts`
- `packages/types/src/identity.ts`

## Merge gates

- Rebuild all candidate SQL scripts on a disposable local Supabase instance and run every contract on the exact PR head.
- Run frontend typecheck/build and TestDZ CI on the exact head.
- Review all routes, feature APIs, legacy fallbacks, RLS policies, RPC grants and Storage policies by role.
- Keep PRs Draft/unmerged until the complete stack and manual mobile/desktop/RTL checks are reviewed.
- No hosted DB writes, Production migration, Edge deployment, secret changes, cron, or Vercel Preview is implied by this inventory.
