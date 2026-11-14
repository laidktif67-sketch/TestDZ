# TestDZ Architecture Audit — 2026-11-14

## Scope and method

Read-only inspection was performed through the connected GitHub repository API. The audit compared the default branch, `architecture-v1`, `feat/developer-report-review`, and `feat/developer-create-test-six-step`, inspected the route modules, identity/authentication guards, package scripts, workflow definitions, relevant migration files, and current pull-request metadata.

No local Termux working tree is visible through this connection. Therefore this report does not claim to know local uncommitted changes or the local checkout's current branch. No branch was deleted, no PR was merged, and no production deployment or remote database migration was performed.

## Recommended working baseline

Use `feat/developer-create-test-six-step` as the immediate baseline for the isolated route-inventory correction because it is the head branch of PR #33 and contains the current split route architecture (`AppRoutes.tsx` plus route modules). Do not use `main` or `architecture-v1` as an assumed integration base without an explicit, reviewed integration plan: comparisons show that these histories are diverged and the route architecture differs materially.

The audit fix is isolated on `fix/architecture-audit-route-inventory`, created from commit `e6a7f8ea27c0c2a4d2f49e6fe9565f23cf741b2b`. This is a stacked repair branch; its eventual PR should target `feat/developer-create-test-six-step`, not `main`.

## Current application map

At `feat/developer-create-test-six-step`, the repository tree contains 824 entries. The web app uses a workspace monorepo:
- Root `package.json` declares workspaces `apps/web` and `packages/*`.
- `apps/web/src/App.tsx` mounts the identity provider and delegates route composition to `AppRoutes.tsx`.
- `apps/web/src/routes/` contains public, authenticated, admin, developer, and tester route groups.
- `apps/web/src/modules/admin`, `modules/developer`, and `modules/tester` hold role-oriented pages/components/styles.
- `apps/web/src/features/` contains data/API modules, including identity, apps, tests, profiles, analytics, and tester-related APIs.
- `apps/web/src/shared/` contains guards and compatibility facades, while `src/pages`, `src/components`, `src/hooks`, `src/lib`, and `src/styles` still exist for public/auth pages and cross-cutting code.
- Shared TypeScript contracts live in `packages/types`.
- Database history and SQL regression tests live in `supabase/migrations` and `supabase/tests`.

This is a transitional feature-based architecture rather than a single fully normalized layout. Do not bulk-move files solely to match a proposed folder template.

## Confirmed findings

### 1. Route inventory contract is stale — low-risk fix applied

`scripts/check-route-inventory.mjs` required 96 explicit paths and 102 `Route` elements, while the current route sources declare 97 explicit paths and 103 elements. The additional route is `/apps/new`, registered in `apps/web/src/routes/developerRoutes.tsx` for `DeveloperAddAppPage`.

The route-inventory contract was updated on the audit branch to include `/apps/new` and expect 97 paths / 103 route elements. A static re-evaluation of the same route-source contracts now finds 97 declared paths, 103 Route elements, no duplicate paths, no missing/extra paths, and no unresolved relative imports from the route modules. This is a source-level check, not an execution of `npm run check:routes`.

### 2. Route composition differs across active branches — high integration risk

- `architecture-v1` declares routes directly in `apps/web/src/App.tsx` and has a smaller set of registered pages.
- `feat/developer-report-review` uses a larger direct route table in `App.tsx`.
- `feat/developer-create-test-six-step` delegates to `AppRoutes.tsx` and five route modules.

The branches also have different page inventories and data/API modules. Replacing `App.tsx` wholesale or resolving conflicts by accepting one side would risk dropping existing routes. Integration must be route-by-route and preserve the role guard nesting.

### 3. Developer create-test page duplication needs usage audit — do not delete yet

The six-step branch contains both `DeveloperCreateTestPage.tsx` and `DeveloperCreateTestSixStepPage.tsx`. The current developer route module registers the six-step page at `/developer/tests/new`; it does not register the older page in the route table. This makes the older page a candidate for deprecation, but its imports and any non-route use must be exhaustively checked before deletion. Shared CSS dependencies must also be reviewed.

### 4. Identity compatibility facade is already in place

In the current six-step branch, `apps/web/src/features/identity/identity-provider.tsx` is the canonical implementation and `apps/web/src/shared/auth/identity-provider.tsx` is already a three-line compatibility re-export. The shared `identity-api.ts`, `identity-context.ts`, and `hooks/useIdentity.ts` files are also compatibility facades into `features/identity`. This is intentional transitional compatibility, not a duplicate implementation on this baseline, so no identity-provider change is needed in this audit batch.

### 5. Page inventory candidates and legacy source folders

The current branch tree contains 29 admin, 20 developer, and 33 tester page files under `modules/*/pages`. The route modules directly import all 29 admin pages, 19 of 20 developer pages, and 32 of 33 tester pages. The two not directly imported by route modules are `DeveloperCreateTestPage.tsx` and `TesterSectionPage.tsx`. These are candidates for a usage audit only; neither was deleted because non-route imports and shared CSS dependencies have not been exhaustively ruled out.

Public/authentication pages remain in `src/pages` and shared code remains across `src/components`, `src/hooks`, `src/lib`, `src/shared`, and `src/features`. That mixed layout is evidence of a gradual migration, not sufficient evidence for bulk file moves.

### 6. Package scripts and CI coverage

The root package exposes `dev`, `build`, `typecheck`, `check:routes`, and `audit:identity-guards`. The web workspace exposes `dev`, `build`, `preview`, and `typecheck`. No dedicated `lint` or frontend unit-test script is declared in these package files.

The web CI workflow runs `npm install`, `npm run typecheck`, and `npm run build`. Separate workflows run the route inventory guard and local Supabase migration/storage regression tests. Static source-contract scripts are useful but do not replace browser tests, authenticated end-to-end checks, or database authorization tests.

### 7. CI evidence must be interpreted carefully

For PR #33 head `e6a7f8ea27c0c2a4d2f49e6fe9565f23cf741b2b`, the GitHub Actions runs for web CI, route inventory, and migration tests were marked failed at approximately two seconds, with no job steps reported and runner ID 0. The route-inventory job for this audit PR (#34) was also retried once (run `43651143604`, attempt 2) and again failed in about two seconds with no steps and runner ID 0. This does not establish a source-code failure; these jobs appear not to have reached their first step. Detailed job logs could not be retrieved through the connected API in this audit.

The Vercel status points to a build-rate-limit page. That is an external preview/build limitation, not proof that the app builds successfully or unsuccessfully. Do not report typecheck/build/SQL tests as passed on the current PR #33 head without a completed run.

For the exact head of PR #31 (`48e73136c37bf4e15ba9aa38256a207e1d4f3cc4`), GitHub reports successful web CI and migration-test workflow runs. Those results apply to that SHA, not to the divergent PR #33 head.

### 8. Migration chain has a possible overlapping app-distribution migration

The six-step branch includes both:
- `20261114000100_app_distribution_links.sql`
- `20261114222735_app_distribution_schema_and_rpc.sql`

Both add app distribution fields and define `create_app_with_distribution`; their allowed distribution methods, defaults, URL validation, and function security model differ. The later migration also backfills legacy Play Store values only where `distribution_method = 'none'`, while the earlier migration sets the new column's default to `external_link`. On an upgrade path where the earlier migration runs first, that backfill predicate may not match existing rows.

This is a database migration risk to reproduce against both a clean database and an upgrade database before deciding on a forward-only corrective migration. Historical migrations should not be edited or removed during the architecture cleanup.

### 9. PR chains are not a single linear integration chain

PR #29 -> #30 -> #31 is a stacked tester check-in/report/review chain. PR #33 targets `feature/developer-full-lifecycle`, not the head of PR #31. The comparison between `feat/developer-report-review` and `feat/developer-create-test-six-step` reports diverged histories (632 commits ahead / 134 behind in the compare direction used). This is not safe to solve by merging all branches at once.

Before integration, explicitly reconcile the report-review RPC/migration and tester submission/check-in changes with the six-step branch, preserving the server-authoritative RPCs and the current data-access boundaries.

## Role and routing review

The current `AppRoutes.tsx` composes public routes outside the authenticated route tree, then nests authenticated routes under `AuthGuard` and `OnboardingGuard`. Admin, tester, and developer route groups each have a `RoleGuard`. Tester security routes are nested in a tester guard. This is a sound structural baseline.

The current `RoleGuard` allows an admin through tester/developer guards as well as the requested role. Whether that is desired admin workspace access or a role-separation exception is a product policy decision; do not silently change it during a refactor. Server/database RLS and RPC authorization remain the actual data boundary.

The tester notification list currently renders each notification as a button whose handler calls only `markRead(row)`; it does not inspect `row.data` or navigate to a destination. The `NotificationRow` type includes `data`, but the UI has no destination resolver. This is a confirmed UX gap, not a reason to guess route semantics: inspect the server-side notification payload producers and define an allow-listed destination contract before implementing click-through navigation. Developer notifications expose a related-test link when a test ID is available, but that flow should be verified separately. Sidebar links, notification destinations, and the complete set of route/page references still need a branch-wide automated inventory and browser-level verification. No page should be deleted based only on its filename or lack of a direct route.

## Incremental repair plan

1. **Keep the isolated route-inventory correction** and obtain a fresh CI run when GitHub runners are available.
2. **Inventory routes and navigation:** extract declared paths, sidebar links, notification destinations, redirects, route guards, and page imports; add tests for missing routes, unreferenced candidates, and role-group placement. Treat potential unused pages as candidates, not automatic deletions.
3. **Reconcile the integration base:** review the exact commits unique to the tester check-in chain and compare the conflicting Developer/Tester pages semantically. Preserve server-side RPC paths, ownership checks, and RLS policies.
4. **Audit feature/API boundaries:** identify duplicate API implementations versus intentional compatibility facades; consolidate only after references and public contracts are mapped.
5. **Review migrations separately:** run clean-install and upgrade regression tests for the overlapping app-distribution migrations; use a new forward-only migration if a fix is proven necessary.
6. **Validate each small batch:** typecheck, build, route inventory, identity guard contract checks, SQL regression tests, and browser role/navigation checks. Record any test that cannot run and its concrete reason.
7. **Open/update a Draft PR only:** never merge to `main` or deploy as part of this cleanup.

## Changes made by this audit branch

- Updated `scripts/check-route-inventory.mjs` to include the existing `/apps/new` route and its corresponding route counts.
- No source page, API, permission policy, schema, or migration was deleted or changed.
- The route-inventory script has not been executed in a local Node environment by this audit. Its expected counts were checked against the route source files through GitHub; runtime verification remains pending.
