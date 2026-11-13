
# TestDZ — Architecture Baseline

**Purpose:** factual checkpoint for the controlled architecture migration.  
**Remote branch:** `feat/admin-dashboard-overview`  
**Reviewed commit:** `77be7294803250eaf48fc3682463084566973cc5`  
**PR:** [#32](https://github.com/laidktif67-sketch/TestDZ/pull/32) — open, draft, not merged.  
**PR base:** `feat/admin-account-suspension-appeals` (not `main`).  
**Important:** this is a remote GitHub snapshot, not a claim that the local Termux worktree has been inspected.

## 1. Repository and worktree status

| Check | Evidence/result | Status |
|---|---|---|
| PR branch | GitHub PR #32 head is `feat/admin-dashboard-overview` | Verified remotely |
| Remote HEAD | `77be7294803250eaf48fc3682463084566973cc5` | Verified remotely |
| PR state | Open, draft, unmerged | Verified remotely |
| PR base | `feat/admin-account-suspension-appeals` | Verified remotely |
| Local current branch and HEAD | Not readable through the GitHub repository API | Not verified in this checkpoint |
| Local `git status --short` | Not readable through the GitHub repository API | Not verified in this checkpoint |
| Local untracked `node_modules/` | Previously reported by the user; must be preserved | Do not delete, clean, reset or overwrite |
| Local changes vs remote branch | Cannot be inferred from GitHub's remote tree | Must be checked in Termux before pulling/cherry-picking |

Do not treat a remote GitHub commit as proof that the local branch is at the same commit. Do not run `git reset`, `git clean`, or destructive checkout commands as part of this work.

## 2. Source inventory

Inventory was read from the recursive Git tree and `apps/web/src/App.tsx` at the reviewed remote SHA.

| Item | Observed count/state |
|---|---|
| Recursive tree entries, including directories | 758 |
| File/blob entries | 655 |
| Route declarations in `App.tsx` | 96 |
| Top-level `src/pages/` TSX pages | 13 |
| `modules/admin/pages/` TSX pages | 29 |
| `modules/developer/pages/` TSX pages | 18 |
| `modules/tester/pages/` TSX pages | 33 |
| CSS files under `apps/web/src/` | 89 |
| Tracked files under `supabase/migrations/` | 47 |
| Tracked files under `supabase/tests/` | 10 |
| Shared types package | `packages/types/` exists with apps, database, identity and profiles type files |
| App entry | `apps/web/src/main.tsx` |
| Route composition | `apps/web/src/App.tsx` |
| npm workspaces | `apps/web`, `packages/*` |

The 96 route declarations include the wildcard route and a redirect alias; they are not 96 unique page components. The 93 page-file count is the sum of the four page directories above, not the route count.

### Current route and guard observations

- `main.tsx` mounts React StrictMode, `BrowserRouter`, `App`, `styles/tokens.css` and `styles.css`.
- `App.tsx` mounts `IdentityProvider` around `Routes`.
- Protected route nesting is `AuthGuard` → `OnboardingGuard` → role-specific `RoleGuard`.
- The public/auth/legal route declarations are outside the authenticated route guard.
- `/help-support` redirects to `/help` with `replace`.
- `/dashboard` renders `RoleHomeRedirect`.
- The wildcard route redirects to `/` with `replace`.
- Route parameters include `:id` and `:invoiceId`; these names must be preserved.
- Admin, developer and tester pages are eagerly imported in `App.tsx`; route extraction must not add lazy loading as part of the first step.
- `RoleGuard` uses `WorkspaceRole = Extract<AccountRole, "tester" | "developer" | "admin">`. The role model also includes `support`; it has no independent role-guarded workspace route in the current route tree.

## 3. Identity and UI boundaries verified from source

- The canonical identity API/provider/context/hook are under `apps/web/src/shared/auth/`.
- `apps/web/src/features/identity/identity-api.ts`, `identity-context.ts`, and `identity-provider.tsx` are small re-export facades pointing to `shared/auth`; do not treat them as a second implementation or delete them before consumer analysis.
- `AuthGuard` reads account status through `identityApi.getAccountStatus`; the identity API selects `profiles.is_banned`.
- The identity API loads roles from `user_roles`; client metadata must not become the authorization source.
- `apps/web/src/components/ui/Card.tsx` re-exports the implementation from `apps/web/src/shared/components/ui/Card.tsx`.
- The AdminSidebar locale type is currently `"ar" | "en"`; French is not represented in that prop type. French LTR support requires a separately tested localization change.
- The web package uses React 18, TypeScript, Vite, React Router 7 and Supabase JS; no browser/component test runner was confirmed in the inspected package manifest.
- Current API examples include `features/apps/api.ts` and `features/profiles/profiles-api.ts`; the full import graph and live-data status have not been exhaustively audited.

## 4. Validation status — do not overstate

| Validation | Result |
|---|---|
| GitHub tree and route-source inspection | Completed at the remote SHA above |
| Local branch/HEAD/worktree inspection | Not available through the remote GitHub API; must run in Termux |
| Local TypeScript command on this exact SHA | Not run in this checkpoint |
| Local build on this exact SHA | Not run in this checkpoint |
| SQL tests on a controlled test database | Not run in this checkpoint |
| Route/browser smoke tests | Not run in this checkpoint |
| Import/dependency-cycle graph | Not generated in this checkpoint |
| Page-by-page live-vs-mock audit | Not complete; PR #32 description explicitly identifies several admin screens as illustrative/demo-only |
| GitHub Actions | Workflow run `43521984315` (run #1198, “TestDZ CI”) is completed with conclusion `failure`; the workflow job logs endpoint returned 404, so the exact failing step/cause is unverified |
| Combined commit status | Vercel status is `failure` with target URL indicating a build-rate-limit upgrade notice; this is a separate status and does not prove the cause of the TestDZ CI workflow failure |

An earlier local typecheck was reported on a different local commit (`5ec6d68`) with 20 TS6133 unused-variable errors. That result is historical and must not be represented as the result for remote SHA `77be729...`.

## 5. Required local baseline commands

Run these in the existing Termux checkout only after reviewing the output; these commands do not modify files:

```sh
git branch --show-current
git log -1 --oneline --decorate
git status --short
git rev-parse HEAD
git rev-parse origin/feat/admin-dashboard-overview
git diff --stat
git diff --cached --stat
npm run typecheck
npm run build
```

Preserve all output, especially any `?? node_modules/` or other local changes. Do not pull or overwrite local changes until the local branch and remote relationship are understood. If local HEAD differs from the reviewed SHA, rerun the route/source inventory on the actual checkout before changing code.

## 6. Gate decision

**Route extraction is not yet authorized by evidence.** The route source is understood at a high level, but the local worktree state, exact-SHA typecheck/build, route behavior tests and dependency-cycle report remain unverified. The first safe completed work should therefore be documentation and baseline recording only. Begin the mechanical route split after these checks are run and failures are understood/classified. No application source, CSS, Supabase migration, RLS, GRANT or RPC file was changed while establishing this baseline.
