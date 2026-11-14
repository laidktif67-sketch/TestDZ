# TestDZ — Identity Migration Checkpoint

**Branch:** `refactor/feature-based-architecture`  
**Latest checkpoint commit before this update:** `0b5042aef17f937eb04f0a7372da4f5c4a2bb590`  
**Scope:** identity import migration, static/build checks, and owner-reported browser smoke tests. This is not a complete authentication/security certification.

## Completed source migration

The canonical identity implementation is under `apps/web/src/features/identity/`:

- `identity-api.ts`
- `identity-context.ts`
- `identity-provider.tsx`
- `hooks/useIdentity.ts`

All 52 previously reported direct consumers of `shared/auth/hooks/useIdentity` were migrated to `features/identity/hooks/useIdentity`. The compatibility facades under `shared/auth/` remain in place.

## Owner-reported static/build validation

The repository owner reported these checks passing on the code checkpoint preceding the current documentation-only commit:

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run build` | Passed in 44.21 seconds |
| `npm run check:routes` | Passed: 102 Route elements; 96 explicit path declarations |
| `node scripts/audit-identity-boundary.mjs` | Completed as an import inventory: 134 source files scanned |
| Direct consumers of legacy `shared/auth/identity-api` | 0 |
| Direct consumers of legacy `shared/auth/identity-context` | 0 |
| Direct consumers of legacy `shared/auth/identity-provider` | 0 |
| Direct consumers of legacy `shared/auth/hooks/useIdentity` | 0 |
| Feature-to-shared/auth imports | 0 |

The import inventory reported 11 direct consumers of the feature API, 3 of the feature context, 2 of the feature provider, and 52 of the feature hook (including compatibility/guard usage as counted by the script).

## Owner-reported Termux runtime smoke test

On 2026-11-14, the repository owner reported these browser checks passing against the local Vite app:

| Check | Result |
|---|---|
| Home page opens | Passed (owner-reported) |
| Protected route | Passed (owner-reported; exact role and negative cases not specified) |
| Sign-in | Passed (owner-reported) |
| Refresh page and retain session | Passed (owner-reported) |
| Permissions | Passed (owner-reported; role matrix and denial cases not specified) |

These results establish a basic successful-path smoke test only. They do **not** establish that sign-out, session refresh through the explicit refresh action, role-fetch failure, banned-account blocking, incomplete onboarding, or every role boundary has been tested.

## Known limitations and remaining gates

- The build previously emitted a Vite warning for an approximately 1.83 MB minified JavaScript chunk and approximately 1.25 MB CSS asset. Build success does not resolve bundle performance.
- `scripts/audit-identity-boundary.mjs` resolves relative imports only. Current `apps/web/tsconfig.app.json` has no `paths` alias configured and `apps/web/vite.config.ts` has no custom `resolve.alias`; nevertheless, the script is an inventory tool, not a complete TypeScript parser or security test.
- Account status is checked from `profiles.is_banned`; missing profile or query error fails closed in `AuthGuard`. This code path still needs a deliberate runtime test with a safe test account/configuration.
- Role loading errors fail closed in `RoleGuard` and `OnboardingGuard`; the error/retry path still needs a runtime test.
- Keep compatibility facades for now. Do not delete them until a broader import audit and runtime checks are complete.
- Do not change role authorization sources, route URLs, guard ordering, Supabase schema/RLS/RPC, or financial behavior during this identity checkpoint.

## Next step

Continue with focused negative-path runtime validation before moving another domain:

1. Sign out and confirm a protected route redirects to `/auth`.
2. With a designated test account only, verify each role's allowed and denied destinations; do not change a real account's role.
3. Verify role-query failure leaves privileged routes blocked and the retry UI available.
4. If a safe banned test account exists, verify the suspended screen blocks protected content; do not suspend or modify a real account for testing.
5. Verify an account with incomplete onboarding is sent to `/onboarding`.
6. Record each check as passed, failed, or not tested; never infer a pass from code inspection alone.

Until those checks are evidenced, classify identity as **static/build validated and basic successful-path smoke-tested; negative-path runtime validation pending**.


## Follow-up source-review observation (not yet classified as a defect)

A focused source review on the current branch found that `identity-api.ts` accepts the `support` role in its allowlist, while `RoleGuard` only defines guarded workspaces for `tester`, `developer`, and `admin`. `getHomePath()` falls back to `/profile` when no recognized workspace role is present, and `/profile` currently renders `TesterProfilePage`.

This is a routing/role-contract question, not proof of an authorization bypass. Do not change role grants, guard order, or destination behavior until the intended `support` user journey is confirmed. Add a dedicated support destination only if that is the approved product behavior, and then test both allowed and denied destinations for a support-only account.

Status: **requires product/owner confirmation; no code change made**.


## Product decision: support role remains unplanned

The repository owner confirmed that a separate support workspace has not yet been planned. Therefore, do not invent a support-specific page or expand its permissions as part of this migration. Keep the current implementation unchanged and retain the routing observation as a deferred product decision. Revisit only when the support workflow and intended access boundaries are defined.

## Follow-up validation recorded on 2026-11-14

The repository owner pulled the branch through commit `e159d87ba06d65b326eacf36fa86a42313ed7c3d` and reported the following local Termux commands completed successfully after the pull:

| Command | Result reported |
|---|---|
| `npm run typecheck` | Passed |
| `npm run check:routes` | Passed: 102 Route elements and 96 explicit path declarations |
| `node scripts/audit-identity-boundary.mjs` | Completed: 134 source files scanned; 68 matched identity imports; 0 direct consumers of the legacy identity API/context/provider/hook modules; 0 feature-to-`shared/auth` imports |

These are fresh owner-reported static checks for the branch state at the time of execution. The commands do not constitute a fresh production build or additional browser runtime tests.

The owner also previously reported successful browser smoke checks for the home page, a protected route, sign-in, refresh persistence, and permissions. The exact role matrix and negative cases were not specified. Sign-out redirect, role-fetch failure/retry, banned-account blocking, and incomplete-onboarding behavior remain **not verified**.

**Gate decision:** do not begin a new identity-dependent domain migration yet. Next, finish the explicitly listed negative-path browser checks using safe test accounts. Mark each outcome as passed, failed, or not tested; do not alter real account roles or suspend real accounts for testing.

## Static guard-contract audit added

A lightweight source-contract audit is available as `npm run audit:identity-guards` (script: `scripts/audit-identity-guard-contracts.mjs`). It checks that critical fail-closed and routing patterns remain present in the identity provider and route guards: stale role requests, role-load errors, sign-out state clearing, unauthenticated redirects, account-status errors and bans, role-error retry, onboarding errors/incomplete onboarding, and guard order.

This is a regression tripwire for source changes, **not** a runtime test, a full authorization proof, or a substitute for Supabase RLS/RPC tests. A passing result must not be recorded as proof that the browser negative paths were exercised.
