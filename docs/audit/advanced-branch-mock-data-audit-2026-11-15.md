# Advanced branch mock-data audit — 2026-11-15

## Scope

Read-only source inspection of `feat/developer-create-test-six-step` at base commit `e6a7f8ea27c0c2a4d2f49e6fe9565f23cf741b2b`. This report identifies preview/sample data and separates it from screens already backed by Supabase. No application code, database schema, database data, or production settings were changed by this audit.

## Confirmed findings

### 1. Developer six-step test creation is connected to Supabase

File: `apps/web/src/modules/developer/pages/DeveloperCreateTestSixStepPage.tsx`

- Loads the authenticated session through `identityApi.getSession()`.
- Loads the developer's apps through `listApps()`, filters to published apps, and displays loading/error states.
- Saves a draft through `createTestDraft()` in `apps/web/src/features/tests/tests-api.ts`.
- This page is not purely mock. However, its header still contains static/inert preview-like elements (hardcoded notification count `3`, avatar `D`, generic user label, and an unbound global search input). These are UI polish/integration gaps, not evidence that draft creation is mocked.

### 2. Tester dashboard has an explicit development preview mode

File: `apps/web/src/modules/tester/pages/TesterDashboardPage.tsx`

- Uses `import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1"` to activate preview mode.
- In that mode it sets a sample name, non-zero stats, sample chart points, a notification count, and sample assignments.
- The displayed labels/values must remain clearly identified as preview-only. Confirm that preview mode is unreachable in production builds and that ordinary sessions use the live query path.

### 3. Admin notifications page is sample-only

File: `apps/web/src/modules/admin/pages/AdminNotificationsPage.tsx`

- The page initializes a hardcoded list of nine example notifications (users/tests/cohorts/system alerts).
- Read/mark actions update local React state only. Broadcast behavior only prepares a preview and explicitly says nothing was sent.
- It is suitable as a labelled UI mock, not as a live admin notification center. Do not treat its sample counts, activity, delivery metrics, or actions as real.

### 4. Admin developer payment details page is sample-only

File: `apps/web/src/modules/admin/pages/AdminDeveloperPaymentDetailsPage.tsx`

- Uses a hardcoded `demo` map for payment IDs and sample developer/payment records.
- The page itself labels the content as preview data and says no payment collection or account changes occur.
- Payment IDs, names, emails, amounts, invoice numbers, and statuses are illustrative only. This page must not be connected to a live payment workflow until a real, authorized payment query and audit-safe action contract exist.

### 5. Developer notifications and developer tests use live Supabase queries

Files:
- `apps/web/src/modules/developer/pages/DeveloperNotificationsPage.tsx`
- `apps/web/src/features/notifications/notifications-api.ts`
- `apps/web/src/modules/developer/pages/DeveloperMyTestsPage.tsx`
- `apps/web/src/features/tests/tests-api.ts`

- Developer notification rows are fetched from `notifications`, filtered by the signed-in user's ID and `recipient_role = 'developer'`; read/archive actions use Supabase updates under existing RLS.
- Developer test rows and assignment summaries are fetched through feature APIs with the signed-in user's ID. This is live data access, although runtime correctness still depends on the deployed schema, grants, RLS, and successful browser/API tests.

### 6. Tester My Tests page uses feature APIs rather than the old static demo

File: `apps/web/src/modules/tester/pages/MyTestsPage.tsx`

- Imports `listTesterMyAssignments`, `listTesterMyFeedback`, `listTesterMyTestRoles`, wallet, notification, and profile APIs.
- This confirms the advanced branch differs from the older `frontend/src/App.tsx` prototype documented in `docs/MOCKUPS_GAP_AUDIT_AR.md`. That older audit must not be treated as a complete inventory of the advanced branch.

## Recommended implementation order

1. Keep the existing six-step create-test flow and validate its current Supabase contract; do not replace it with mock state.
2. Remove or wire the inert developer-header search, notification count, and avatar/user identity so they do not imply live information that is not loaded.
3. Keep tester preview data explicit and development-only; add a focused check for production exclusion and avoid presenting preview values as real activity.
4. Keep admin notifications and payment details labelled as previews until their real read APIs and permitted server-side actions are implemented. Never allow sample rows to trigger real administrative or financial actions.
5. Continue the missing-screen inventory on this advanced branch before implementing additional pages. Prioritize the tester assignment/check-in lifecycle and developer campaign lifecycle against existing API/schema contracts.
6. Separately perform real browser/PostgREST/Storage behavioral tests. Static code inspection is not runtime validation.

## Safety and validation limits

- No Supabase project was modified.
- No migrations were applied.
- No PR was merged, no branch deleted, and `main` was not changed.
- No GitHub Actions workflow was triggered.
- This was a source-level inspection only; no TypeScript/build/browser tests were run during this review.
- Production readiness is not established.
