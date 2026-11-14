
# TestDZ — Architecture Target

**Status:** approved target direction; migration not yet complete  
**Repository:** `laidktif67-sketch/TestDZ`  
**Current migration ref:** `refactor/feature-based-architecture` at `09dd9f6f6b76f3ecc7f9dc4f439abd5b2ef9cb67` (route inventory check passed; user reports production build passed; typecheck result for this exact commit not yet confirmed here)  
**Scope:** architecture and controlled migration plan only. This document does not authorize a rewrite, database changes, production deployment, or merge to `main`.

## 1. Architectural decision

Adopt a **feature-based modular monolith** for the existing React + TypeScript + Vite web client. Keep React Router, Supabase, and npm workspaces. Organize code by business capability, expose explicit module entry points, and keep infrastructure and shared presentation primitives separate from feature behavior.

This is an incremental target, not a mandate to move every existing file. Preserve current URLs and behavior first. Do not add layers, state libraries, service abstractions, or new packages unless a demonstrated dependency or reuse problem justifies them.

### Target repository shape

```text
/
├── apps/
│   └── web/
│       └── src/
│           ├── app/                   # future home for app-wide providers and composition
│           ├── routes/                # current migration implementation
│           │   ├── publicRoutes.tsx
│           │   ├── authenticatedRoutes.tsx
│           │   ├── testerRoutes.tsx
│           │   ├── developerRoutes.tsx
│           │   └── adminRoutes.tsx
│           ├── pages/                 # public/auth/legal/onboarding entry pages
│           ├── features/
│           │   ├── identity/
│           │   ├── profiles/
│           │   ├── apps/
│           │   ├── testing/
│           │   ├── cohorts/
│           │   ├── assignments/
│           │   ├── feedback/
│           │   ├── rewards/
│           │   ├── subscriptions/
│           │   ├── payments/
│           │   ├── support/
│           │   ├── notifications/
│           │   └── trust-safety/
│           ├── shared/
│           │   ├── ui/
│           │   ├── icons/
│           │   ├── layout/
│           │   ├── navigation/
│           │   ├── forms/
│           │   ├── tables/
│           │   ├── hooks/
│           │   └── i18n/
│           ├── infrastructure/
│           │   └── supabase/           # only when moved with a verified import map
│           ├── styles/
│           │   ├── tokens.css
│           │   └── globals.css
│           └── test/                   # add only with an adopted test runner
├── packages/
│   └── types/                          # existing shared TypeScript contracts
├── supabase/                           # configuration, migrations, SQL tests
├── scripts/
└── docs/
```

This is a target map, not a claim that these directories all exist today. Create a target directory only when a real file is migrated into it. The existing root `styles.css` can remain at its current path until a separate, tested stylesheet move is warranted; do not combine a CSS redesign with file moves. Do not create a source-level `workspaces/` directory.

## 2. Folder responsibilities and dependency boundaries

| Area | Responsibility | May depend on | Must not own |
|---|---|---|---|
| `app/` | Application composition, route registration, top-level providers and guard composition | feature public entry points, shared, infrastructure adapters | domain rules or page-specific business logic |
| `pages/` | Public landing, authentication callbacks, legal pages, onboarding and profile-completion entry pages | app-facing features, shared | duplicate auth/session implementation |
| `features/<domain>/` | Domain-specific pages, UI, hooks, API adapters, types and focused tests | shared, infrastructure through narrow adapters, `@testdz/types` | another feature's private internals |
| `shared/` | Reusable, domain-neutral UI, icons, layout, navigation primitives, hooks and locale utilities | React and low-level utilities | Supabase queries, financial rules, role decisions, feature-specific workflows |
| `infrastructure/` | External-service setup and technical adapters (Supabase client/config, and future adapters only if justified) | third-party SDKs, environment config | route decisions or domain UI |
| `packages/types/` | Cross-workspace, platform-neutral TypeScript contracts and database-generated types | TypeScript | React UI, browser APIs, runtime business side effects |
| root npm workspaces | Package/install/build boundaries: currently `apps/web` and `packages/*` | package manifests | a new UI or routing layer |
| root `supabase/` | Supabase config, SQL migrations, RLS/grants/RPC definitions and SQL tests | Supabase tooling | frontend file-migration concerns |

**Dependency rule:** route composition may import a feature's documented public entry point. Feature A must not reach into Feature B's private `components/`, `hooks/`, or API implementation. If two features need the same behavior, first decide whether it is a genuine domain contract or a domain-neutral shared primitive; do not solve it by making all features import each other. Avoid cycles. A feature should not import from `app/router`.

### Terms that must not be conflated

- **app**: the web application's composition boundary—providers, route assembly and guards. It is not a business domain.
- **pages**: top-level public/auth/onboarding pages. A page is a screen entry point, not automatically a reusable domain module.
- **workspaces**: in this repository, npm workspaces are package/install boundaries configured in the root `package.json` (`apps/web`, `packages/*`). “Tester”, “Developer” and “Admin” are role-based product workspaces, not a reason to create a second npm package or a new `src/workspaces` layer.
- **features**: business capabilities and their owned UI/data behavior, organized by domain rather than by the role that happens to use them.
- **shared**: domain-neutral UI and utilities used by multiple features.
- **infrastructure**: technical integration with external systems. It does not decide who may use a feature; backend policy remains authoritative.

## 3. Identity, authentication and authorization: one source of truth

The current canonical implementation is under `apps/web/src/shared/auth/`; run `node scripts/audit-identity-boundary.mjs` from the repository root to inventory direct consumers before changing ownership:

- `identity-api.ts`: Supabase Auth/session access and account/role reads.
- `identity-provider.tsx`, `identity-context.ts`, `hooks/useIdentity.ts`: session, user, role state and its React context.
- `shared/guards/AuthGuard.tsx`, `OnboardingGuard.tsx`, `RoleGuard.tsx`: route access and redirects.
- `features/identity/identity-api.ts`, `identity-context.ts`, and `identity-provider.tsx` currently re-export the canonical shared implementation. They are compatibility facades, not a second identity service; retain them until the import graph proves they have no consumers and a migration removes them safely.

Target policy:

1. One canonical session/identity implementation; no parallel providers, role caches, or independent auth listeners introduced during migration.
2. Account roles are read through the current identity API and the backend-managed `public.user_roles` relationship. Do not authorize from editable profile fields or client `user_metadata`.
3. Keep the existing account-ban check and its error/redirect behavior unless a separately reviewed security change explicitly approves otherwise.
4. Client guards are UX/navigation controls, not the security boundary. Supabase RLS, grants, and server-side RPC/database checks remain authoritative.
5. The `support` account role exists in the role model but is not part of the current `WorkspaceRole` union (`tester | developer | admin`). Do not invent a Support workspace route; record and resolve that product decision separately.
6. Keep `IdentityProvider` above the route tree. Do not introduce a second provider at feature level.

## 4. Routing, guards and redirect contract

The current `main.tsx` mounts `BrowserRouter`; `App.tsx` mounts `IdentityProvider` around `AppRoutes`. Route declarations have been mechanically split into `src/routes/` modules. Protected route nesting applies `AuthGuard` → `OnboardingGuard` → role-specific `RoleGuard`; preserve this ordering and test it after each grouped extraction.

Routing extraction must be a mechanical move first: route paths, route elements, nesting, and order remain unchanged. Do not change paths, aliases, parameters, wildcard handling, redirects, role precedence, or guard logic in the same commit.

The currently verified route inventory is **96 route declarations in `App.tsx`**, including the wildcard and `/help-support` redirect. A declaration count is not the same as a unique screen count. Snapshot the full route list and representative redirect/guard behavior before and after any split.

Acceptance requirements for routing:

- Keep all current path strings and parameter names, including `:id` and `:invoiceId`.
- Keep `/help-support` → `/help` with `replace`, `/dashboard` through `RoleHomeRedirect`, and `*` → `/` with `replace`.
- Keep public routes outside the authenticated guard and preserve current protected nesting.
- Keep all page imports reachable; do not add lazy loading in the route-split change.
- Verify the built route inventory against the source inventory and test authorized, unauthorized, loading/error and redirect cases before proceeding.

## 5. UI, icons and design system

The current design foundations include `apps/web/src/styles/tokens.css`, `apps/web/src/styles.css`, and `apps/web/src/shared/components/ui/Card.tsx`. `apps/web/src/components/ui/Card.tsx` is a compatibility re-export of that Card implementation. Keep this facade until all imports are migrated and verified; do not delete it based on its small size.

Target ownership:

- `shared/ui/`: shared, domain-neutral controls and primitives. Promote components only after at least two real consumers or a stable product-wide contract is confirmed.
- `shared/icons/`: one named icon API and consistent sizing/accessibility for interface icons. First inventory the existing custom SVG/inline icon implementations. Preserve brand and payment-provider marks as branded assets; never replace them with generic symbols.
- `shared/navigation/`: reusable sidebar/layout behavior plus role-specific navigation configuration. Do not flatten role-specific access rules into visual menu visibility.
- `styles/tokens.css`: design tokens remain the source for colors, spacing, typography, borders, focus and related primitives.
- Feature-specific styles remain near the feature during migration. Move them only alongside their owner and after visual checks; no broad CSS rewrite or global selector change is part of route extraction.

Avoid creating duplicate Card, Button, icon, or navigation systems. Before consolidation, compare props, accessibility, variants, imports and rendered behavior.

## 6. Language and direction policy

Required supported locales are Arabic, French and English. Arabic pages use RTL; French and English pages use LTR. Direction must derive from the active locale, not from a hard-coded page or the user's role. Prefer CSS logical properties (`margin-inline`, `padding-inline`, `inset-inline`, `text-align: start/end`) over left/right assumptions.

The current AdminSidebar prop type was verified as `locale?: "ar" | "en"`; French is not represented there today. Treat this as a known coverage gap to address in a dedicated, reviewed localization step, not as a reason to change direction behavior during route extraction. Before changing locale plumbing, inventory existing translation dictionaries, persisted locale preferences and all page-level `dir` assignments. Do not silently change translations or locale defaults.

Acceptance checks must include Arabic RTL and French/English LTR at mobile and desktop widths, sidebar placement, icons/arrows, forms, tables, dialogs and long text.

## 7. File migration map based on the inspected tree

The mappings below refer to files/directories that exist at the reviewed ref. They are future destinations, not immediate moves.

| Existing source | Proposed destination | Rule |
|---|---|---|
| `apps/web/src/AppRoutes.tsx` plus `apps/web/src/routes/*` | Keep `AppRoutes.tsx` as composition root initially; consider moving under `app/router/` only after validation. | Route modules exist on the migration branch; route inventory check passed and the user reports a successful build on this commit. Exact-SHA typecheck and browser/runtime route checks remain unconfirmed. |
| `apps/web/src/main.tsx` | Keep at current path initially | It mounts StrictMode, BrowserRouter and global styles; move only if a real app-entry convention is needed. |
| `apps/web/src/pages/LandingPage.tsx`, `AuthPage.tsx`, `AuthCallbackPage.tsx`, `SignupSuccessPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `PasswordResetSuccessPage.tsx`, `InvalidOtpPage.tsx`, `VerifyEmailPage.tsx`, `LegalPage.tsx` | Keep in `pages/` initially | Public/auth/legal screens. Auth logic must continue to call the canonical identity API. |
| `apps/web/src/pages/OnboardingPage.tsx`, `InterestsPage.tsx`, `ProfileCompletionPage.tsx` | Keep in `pages/` initially; profile-owned logic may later move to `features/profiles` | Keep current onboarding routes and guard exceptions unchanged. |
| `apps/web/src/modules/tester/pages/TesterDashboardPage.tsx`, `MyTestsPage.tsx`, `DiscoverTestsPage.tsx`, `TestPreviewPage.tsx` | `features/testing/` | Preserve tester route aliases and screen behavior. |
| `apps/web/src/modules/tester/pages/AssignmentDetailsPage.tsx`, `ActiveAssignmentProgressPage.tsx`, `AssignmentSubmissionPage.tsx`, `TestCompletionSummaryPage.tsx`, `TestCompletionRewardPage.tsx` | `features/assignments/` and `features/rewards/` by actual ownership | Keep the completion/reward boundary explicit; do not change reward or validation rules. |
| `apps/web/src/modules/tester/pages/TesterProfilePage.tsx` and profile-related settings/privacy pages | `features/profiles/` | Move as one coherent domain slice after imports and API ownership are checked. |
| `apps/web/src/modules/tester/pages/SubmitFeedbackPage.tsx`, `FeedbackHistoryPage.tsx`, `ReportProblemPage.tsx` | `features/feedback/` | Verify which records are live versus local/demo before claiming integration. |
| `apps/web/src/modules/tester/pages/HelpSupportPage.tsx`, `SupportCenterPage.tsx`, `SupportTicketDetailsPage.tsx`, `LiveChatPage.tsx` | `features/support/` | Do not infer that a screen is connected to live support data; inspect each API and mutation. |
| `apps/web/src/modules/tester/pages/WalletRewardsPage.tsx`, `WithdrawalRequestPage.tsx`, `WithdrawalStatusPage.tsx`, referral pages | `features/rewards/` with payments/withdrawals split only if existing domain contracts justify it | No financial behavior, balances, RPCs or ledger rules may change during a move. |
| `apps/web/src/modules/tester/pages/NotificationsCenterPage.tsx`, notification preferences and activity/security history pages | `features/notifications/` or `features/trust-safety/` by domain | Keep distinct security history and notification preference semantics. |
| `apps/web/src/modules/developer/pages/DeveloperAppsPage.tsx`, `DeveloperAppDetailPage.tsx` | `features/apps/` | Existing public routes remain `/apps` and `/apps/:id`. |
| `apps/web/src/modules/developer/pages/DeveloperMyTestsPage.tsx`, campaign details/create/monitoring/testers/results/analytics pages | `features/testing/` | Keep developer-owned test creation and monitoring distinct from tester execution. |
| Developer subscription page | `features/subscriptions/` | Payment activation and subscription state remain backend-authoritative. |
| Developer feedback pages | `features/feedback/` | Preserve role-specific presentation while sharing stable domain contracts. |
| Developer help/support pages | `features/support/` | Keep distinct routes and ticket identifiers. |
| Developer notifications page | `features/notifications/` | Keep current route and data behavior. |
| `apps/web/src/modules/admin/pages/AdminDashboardPage.tsx`, `AdminAnalyticsPage.tsx`, `AdminReportsReviewsPage.tsx`, `AdminNotificationsPage.tsx`, `AdminSystemMonitoringPage.tsx`, `AdminSystemLogsPage.tsx` | Feature domains for analytics, notifications and trust/safety; admin-only composition may remain in an admin feature if it owns a real workflow | Do not make role-specific screen composition a reason to duplicate the underlying domain API. |
| Admin apps/tests/assignments/cohorts pages | `features/apps/`, `features/testing/`, `features/assignments/`, `features/cohorts/` respectively | Inspect each page's live/mock data boundary before moving or changing behavior. |
| Admin users/testers/developers and detail pages | `features/profiles/` or the relevant user/developer domain; keep admin-specific composition at the edge | No role, suspension or account mutation changes in a file move. |
| Admin support and medical-exceptions pages | `features/support/` and `features/trust-safety/` | Treat existing demo data and backend integration status separately. |
| Admin financial, withdrawals, transactions ledger, developer payments, invoice and rewards pages | `features/payments/` and `features/rewards/` based on verified ownership | No database, RPC, grant, RLS or financial rule edits in this migration. |
| `apps/web/src/shared/auth/*` and `apps/web/src/shared/guards/*` | Keep canonical paths initially; later move guards to `app/guards/` only with import and behavior snapshots | `features/identity/*` are verified re-export facades and must not be deleted prematurely. |
| `apps/web/src/components/ui/Card.tsx` | Keep as facade until all imports are verified | It re-exports `shared/components/ui/Card.tsx`. |
| `apps/web/src/shared/components/ui/Card.tsx`, `apps/web/src/styles/tokens.css`, `apps/web/src/styles.css` | Shared UI/design-system ownership; move only in a dedicated mechanical change | No global style redesign in the same PR. |
| `apps/web/src/modules/{admin,developer,tester}/styles/` | Move styles beside their feature only as each feature moves | Keep selectors and visual output stable; no blanket CSS movement. |
| `apps/web/src/lib/supabase.ts`, `features/apps/api.ts`, `features/profiles/profiles-api.ts` | Current files stay until an import/data-access audit justifies an infrastructure adapter | No API behavior changes or schema edits as part of folder moves. |
| `packages/types/` | Keep as the cross-workspace contract package | Extend only for genuinely shared platform-neutral types. |
| `.github/workflows/`, `supabase/config.toml`, `supabase/migrations/`, `supabase/tests/`, `scripts/`, `.env.example` | Keep in place | Outside frontend route/file-move scope; database files are frozen for this migration. |

The source tree contains 29 admin page files, 18 developer page files, 33 tester page files and 13 top-level page files. Do not move all 93 page files in one batch. The table gives ownership-level destinations; before each individual move, confirm the exact file, imports, CSS, API calls and actual data behavior at the then-current branch head.

## 8. Files and boundaries to leave in place for now

- `apps/web/src/main.tsx` and global CSS imports.
- `apps/web/src/shared/auth/` as the canonical identity implementation.
- `apps/web/src/shared/guards/` and `apps/web/src/features/identity/` compatibility re-exports.
- `apps/web/src/components/ui/Card.tsx` and `apps/web/src/shared/components/ui/Card.tsx`.
- `apps/web/src/lib/supabase.ts`, existing feature API files and all Supabase database types.
- All existing page and module CSS until its owner moves in an isolated change.
- Root npm workspace manifests and lockfile unless a tested dependency change is explicitly approved.
- `packages/types/`, `supabase/`, `scripts/`, `.github/workflows/`, environment examples and repository docs.
- All local untracked/modified files. Never use reset/clean/delete operations to make a migration convenient.

No existing folder is declared “unnecessary” solely because it is absent from the target sketch. Remove a folder only after a consumer search proves it is empty/unreferenced, the proposed replacement is already verified, and the change has passed the relevant checks.

## 9. Staged migration plan and acceptance gates

### Stage 0 — Freeze the baseline (required before source changes)
- Confirm local branch, HEAD, full `git status --short`, and remote tracking state without modifying the worktree.
- Record the exact route declarations and route/guard tree; identify redirects and role routing.
- Run the existing typecheck, build and available tests on the exact baseline SHA; record command, exit status and output.
- Inspect workflow jobs/logs; do not guess why a failed run failed.
- Produce an import graph and cycle report using a dependency-analysis tool compatible with the repo, and manually review the relevant edges.
- Inventory real Supabase-backed calls versus local/mock/sample state for the affected screens.
- Gate: no route extraction until baseline failures are understood or explicitly classified as pre-existing and a test plan protects the affected behavior.

### Stage 1 — Mechanical route extraction (first source-code stage)
- Extract route declarations into explicit route modules without changing route values, JSX elements, nesting or guard order.
- Keep eager imports; do not introduce lazy loading, new route conventions or UI changes.
- Gate: typecheck, build, route inventory diff (expected zero route differences), guard/redirect tests, and a manual smoke test for public, tester, developer and admin paths. Stop on any unexplained difference.

### Stage 2 — Canonical identity boundary
- Run `node scripts/audit-identity-boundary.mjs` to inventory direct imports and feature-to-shared edges for `shared/auth` and `features/identity`; preserve compatibility exports while consumers are migrated.
- Decide the final canonical path only after consumer counts and test coverage are known.
- Gate: one provider/session source, role loading/error and banned-account behavior preserved, and no changes to Supabase authorization contracts.

### Stage 3 — Shared UI and icons
- Audit existing Card/Button/form/table/sidebar/icon implementations and consumer props.
- Consolidate one component family at a time; retain old re-exports until no consumers remain.
- Gate: typecheck/build, component-level checks where available, and visual comparisons in Arabic RTL, French LTR and English LTR on mobile/desktop.

### Stage 4 — Domain-by-domain feature moves
- Move one coherent domain at a time (for example Apps, then Feedback, then Support), with page + API/hooks/types + local styles together only when ownership is confirmed.
- Do not combine unrelated features or global CSS cleanup.
- Gate per domain: route snapshot unchanged, import resolution clean, tests for the affected behavior, live/mock boundary documented, and no unintended Supabase/RPC/schema change.

### Stage 5 — Cleanup and optional optimization
- Remove compatibility facades only after repository-wide consumer search and successful tests.
- Consider lazy routes, shared query/state libraries, or broader CSS changes only as separately scoped decisions with measured benefit.
- Gate: no orphan imports/files, no dependency cycles, all domain acceptance checks green, and owner approval before merge/deployment.

## 10. Explicit non-goals and stop conditions

- No full rewrite, all-at-once move, feature deletion or visual redesign.
- No financial behavior, role authorization, account suspension, grants, RLS, RPC or migration changes.
- No production deployment and no merge to `main`.
- Stop if tests fail unexpectedly, a route/redirect changes, a circular dependency is introduced, the live/mock status is unclear for a changed page, or a local change could be overwritten.
- A successful build alone is not proof of behavioral safety.

## 11. Approval and completion definition

This document approves the direction and staged plan only. Architecture migration is complete only after every moved domain has passed its own acceptance gate and all route, auth, locale, data-access and visual regressions introduced by the changes have been checked. The current repository has not yet met that completion definition.
