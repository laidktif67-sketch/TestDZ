# TestDZ Developer Workspace — Gap Audit

**Audit date:** 2026-11-14  
**Branch:** `refactor/feature-based-architecture`  
**Audited revision:** `8b748180697dc03d223182a60024e02518b6f2db`

## Scope and method

This is a static repository audit of the Developer and Tester page files, role route declarations, the Developer sidebar, the app detail screen, and the existing billing API. It does not claim browser/runtime validation or database verification.

## Page inventory

Counts are source files under `apps/web/src/modules/<role>/pages/`, not the number of sidebar links.

| Role | Page files | Route declaration context |
|---|---:|---|
| Tester | 33 | Includes task/assignment steps, account preferences, security, history, rewards, withdrawals, referrals, and support |
| Developer | 18 | Includes app/test workflows, monitoring, results, feedback, subscription, notifications, settings, and support |
| Admin | 29 | Includes user and app management, financial operations, payments/invoices, reports, audit, and system monitoring |

The Tester area has more page files because it has more individual participant steps and personal-account flows. File count alone does not establish that Developer is incomplete.

## Developer routes and sidebar

The Developer route module declares 18 routes. The sidebar has 13 top-level links. The difference is explained by contextual/detail routes that are expected to be opened from a parent record:

- `/apps/:id` — app details, linked from My Apps
- `/developer/tests/:id` — campaign details, linked from My Tests
- `/developer/tests/:id/monitoring` — monitoring for one test/campaign
- `/developer/feedback/:id` — one feedback record
- `/developer/support/:id` — one support ticket

These five routes do not automatically need their own sidebar entries. The create-test route is already a top-level sidebar item. The current route tree nests Developer routes under `RoleGuard requiredRole="developer"`; do not weaken or bypass this guard to make routes visible.

## Confirmed gaps / limitations

### 1. Subscription checkout is not enabled

`DeveloperSubscriptionPage.tsx` explicitly tells the user plan changes and checkout are not enabled and directs them to contact support. Plan selection currently shows a notice; it does not perform checkout. The page also marks draft pricing when plan metadata indicates draft values.

### 2. Payment history is a summary, not invoice management

`features/billing/billing-api.ts` only reads the eight latest payment summaries with `id, amount_dzd, provider, status, created_at`. The Developer subscription page renders these summaries. No Developer invoice-detail route/API is present in the audited route list. Admin has separate payment and invoice-detail pages, but those must remain Admin-only.

Do **not** create a fake invoice download or claim a payment was completed. A real invoice feature needs a confirmed invoice data contract and an authorized read path for the owning Developer, plus server-generated or trusted invoice content.

### 3. App details contain explicit placeholder sections

`DeveloperAppDetailPage.tsx` contains a “Coming Soon” section saying test-cycle management and internal reviews/quality reports will be available later. This is a real product capability gap, not a missing navigation link. The current page does support viewing/editing app details and archive/restore actions.

### 4. Publishing workflow needs verification before changing it

`DeveloperCreateTestPage.tsx` imports `createTestDraft` and the flow returns to My Tests after creating the record. Before adding a separate publish page or changing statuses, verify the current backend state machine and the exact meaning of the UI's Publish step. Do not make the client bypass server-side workflow rules.

## Recommended implementation order

1. **First: close the Developer navigation and route audit** by exercising the existing 13 sidebar links and all five contextual routes as a Developer, and verify that Tester/Admin accounts cannot open them.
2. **Second: app/test lifecycle** — define the supported lifecycle and server operations for app-linked test cycles; then implement only missing actions using existing feature APIs and authorized server-side paths.
3. **Third: invoice visibility** — confirm whether an invoice table, invoice identifier, PDF/document storage, and owner-scoped RLS/API already exist. If absent, design the data contract and authorization first; do not build a visual-only invoice page.
4. **Fourth: checkout/plan changes** — keep disabled until a trusted server-side payment/checkout flow and reconciliation behavior exist.
5. **Optional later:** API keys/integrations only if explicitly in the product requirements; they are not assumed to be required just because another dashboard has more pages.

## Safety constraints

- Preserve the separation between Tester, Developer, and Admin.
- Keep the current role guards, route URLs, RLS, RPC, schema, and money-related server logic unchanged during this audit.
- Do not add duplicate pages just to increase page count.
- No database changes, payment activation, merge to `main`, or production deployment were performed as part of this audit.
- This document is static analysis only. Typecheck, build, browser checks, and role-based runtime tests remain pending.
