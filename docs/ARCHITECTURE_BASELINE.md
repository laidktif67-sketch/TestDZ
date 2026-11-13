
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

## 5. Route declaration inventory from source (96)

The following is the exact declaration order extracted from the reviewed `App.tsx`. It is the **source baseline**. A live browser/runtime comparison was not possible in this checkpoint, so runtime parity remains an open gate rather than a passed check.

1. `/`
2. `/terms`
3. `/privacy`
4. `/auth`
5. `/signup-success`
6. `/auth/callback`
7. `/verify-email`
8. `/forgot-password`
9. `/reset-password`
10. `/password-reset-success`
11. `/invalid-otp`
12. `/onboarding`
13. `/interests`
14. `/complete-profile`
15. `/assignments/:id`
16. `/assignments/:id/progress`
17. `/assignments/:id/submit`
18. `/assignments/:id/summary`
19. `/profile`
20. `/feedback-history`
21. `/submit-feedback`
22. `/report-problem`
23. `/wallet-rewards`
24. `/withdrawal-request`
25. `/withdrawal-status`
26. `/help`
27. `/support`
28. `/support/:id`
29. `/live-chat`
30. `/help-support`
31. `/settings`
32. `/notification-preferences`
33. `/active-sessions`
34. `/tester/security-history`
35. `/notifications`
36. `/admin`
37. `/admin/analytics`
38. `/admin/leaderboard`
39. `/admin/apps`
40. `/admin/reports`
41. `/admin/notifications`
42. `/admin/monitoring`
43. `/admin/logs`
44. `/admin/financial`
45. `/admin/tester-withdrawals`
46. `/admin/tester-withdrawals/:id`
47. `/admin/withdrawal-failed/:id`
48. `/admin/rewards`
49. `/admin/transactions-ledger`
50. `/admin/developer-payments`
51. `/admin/developer-payments/:id`
52. `/admin/invoices/:invoiceId`
53. `/admin/medical-exceptions`
54. `/admin/support`
55. `/admin/users`
56. `/admin/developers`
57. `/admin/developers/:id`
58. `/admin/testers`
59. `/admin/testers/:id`
60. `/admin/tests`
61. `/admin/assignments`
62. `/admin/cohorts`
63. `/admin/settings`
64. `/admin/audit-trail`
65. `/dashboard`
66. `/tester-dashboard`
67. `/my-tests`
68. `/assignments/:id/reward`
69. `/leaderboard`
70. `/tester/language-appearance`
71. `/tester/privacy`
72. `/check-in-history`
73. `/activity-history`
74. `/referral-program`
75. `/referral-history`
76. `/discover-tests`
77. `/tests/:id`
78. `/developer-dashboard`
79. `/developer/tests`
80. `/developer/tests/:id`
81. `/developer/tests/:id/monitoring`
82. `/developer/tests/new`
83. `/developer/settings`
84. `/developer/subscription`
85. `/developer/testers`
86. `/developer/analytics`
87. `/developer/results`
88. `/developer/feedback`
89. `/developer/feedback/:id`
90. `/developer/notifications`
91. `/developer/help`
92. `/developer/support`
93. `/developer/support/:id`
94. `/apps`
95. `/apps/:id`
96. `*`

**Runtime comparison status:** not run. No app server/browser session was available through the GitHub source inspection. Do not claim that these declarations have been compared to rendered runtime routes until the local app is started and checked.

## 6. Required local baseline commands

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

## 7. Gate decision

**Route extraction is not yet authorized by evidence.** The route source is understood at a high level, but the local worktree state, exact-SHA typecheck/build, route behavior tests and dependency-cycle report remain unverified. The first safe completed work should therefore be documentation and baseline recording only. Begin the mechanical route split after these checks are run and failures are understood/classified. No application source, CSS, Supabase migration, RLS, GRANT or RPC file was changed while establishing this baseline.
