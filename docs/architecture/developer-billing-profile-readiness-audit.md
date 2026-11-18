# Developer billing and account settings — readiness audit

**Status:** read-only implementation audit. This document records the current V2 implementation and the safe next steps. It does not enable billing, change account data, or alter hosted Supabase.

## Scope and evidence inspected

Reviewed the Developer workspace settings page and dashboard links, shared account settings and profile pages, profile data API, active-session API/page, language and appearance settings, subscription schema and read RPC, plan seed, and app-limit enforcement migration on the current stacked Developer implementation.

Relevant implementation:
- `apps/web/src/modules/developer/pages/DeveloperWorkspaceSettingsPage.tsx`
- `apps/web/src/modules/tester/pages/SettingsSecurityPage.tsx`
- `apps/web/src/modules/tester/pages/TesterProfilePage.tsx`
- `apps/web/src/modules/tester/pages/ActiveSessionsPage.tsx`
- `apps/web/src/modules/tester/pages/LanguageAppearancePage.tsx`
- `apps/web/src/features/profiles/profiles-api.ts`
- `apps/web/src/shared/auth/identity-api.ts`
- `supabase/migrations/20261106173140_subscription_rpc_invoker_and_admin_reads.sql`
- `supabase/migrations/20261106173720_seed_subscription_plans.sql`
- `supabase/migrations/20261106175505_apps_crud_storage_and_plan_limits.sql`

## 1. Developer billing and subscription findings

### What exists
- The Developer workspace has a read-only plan and usage section. It reads app/test counts and the existing app-limit RPC; its copy explicitly says upgrades, billing and payments are not enabled.
- The schema has `plans`, `subscriptions`, `payments` and `refunds`.
- Subscription, payment and refund rows are owner-readable (or admin-readable) through RLS. Authenticated clients receive SELECT, not direct INSERT/UPDATE/DELETE grants for these financial tables.
- `get_active_subscription()` is SECURITY INVOKER, uses the caller's `auth.uid()`, and returns plan code/features/limits/expiry for the caller's current active/trialing subscription.
- App creation and restore enforce plan app limits inside server-side database functions, rather than trusting a browser-supplied plan or count.
- Free/Plus/Pro catalog rows are seeded, but the seed labels prices as draft configuration. The blueprint records Chargily as the intended provider but explicitly keeps payments disabled until a verified webhook exists.

### Gaps and decisions
1. There is no implemented checkout creation, provider signature verification, webhook activation, renewal, cancellation, refund processing, or customer billing portal in the inspected V2 branch.
2. The subscription table permits `past_due` and the unique-current index includes it, but `get_active_subscription()` returns only `active` and `trialing`. App-limit logic falls back to the Free plan when that RPC returns no row. This means a past-due account is currently treated like Free for app limits. This may be intentional, but the grace-period/downgrade policy must be decided and tested before billing implementation.
3. The plan seed contains draft prices and draft pricing metadata. Do not display these as final commercial prices until the owner approves the amounts, billing periods, taxes/fees, renewal policy and refund policy.
4. No provider credentials or production billing configuration were verified. Do not add a live checkout button or simulate a successful payment.

### Safe implementation order
- Confirm the payment provider (Chargily remains the blueprint choice, not proof of a configured integration) and its current API/webhook signature contract.
- Confirm past-due grace period, cancellation timing, renewal behavior, failed-payment retries and downgrade effects on existing apps/tests.
- Implement a server-only, idempotent pending-payment creation boundary; verify provider signatures on the server; activate subscriptions only after verified provider events.
- Add a reconciliation path for duplicate/out-of-order webhooks and timeouts, plus audit records and owner-scoped payment history.
- Add checkout UI only after the backend and provider sandbox tests pass. Keep production payment flags disabled until end-to-end verification and explicit release approval.

## 2. Profile and account settings findings

### What exists
- The shared `/settings` page is used by Tester and Developer accounts. It supports account display name/locale, email change with confirmation, password change, TOTP MFA enrollment/verification/unenrollment, notification preferences, theme, privacy export, and links to session/security history.
- Profile data is read through the profile API and updated through the authenticated data client. The underlying profile table has owner-scoped RLS and column-limited client update grants for non-privileged profile fields. Role, verification, ban and subscription-tier fields are not part of the normal profile update payload.
- Avatar uploads use a per-user Storage folder, validate MIME type/size in the UI and API, use versioned filenames, update the profile pointer, and attempt best-effort cleanup after the new avatar is saved.
- Active-session management uses the caller-scoped `get_my_active_sessions` RPC and Supabase Auth's `signOut({ scope: "others" })`; if the V2 session list is unavailable, the UI says so rather than inventing device records.
- Language/appearance settings persist locale in `profiles` and display preferences in user metadata. The Developer workspace language selector is explicitly browser-local.

### Gaps and UX inconsistencies
1. The profile page and shared Settings page overlap: the profile page has disabled placeholder toggles for MFA/notifications and says some preferences are unavailable, while `/settings` provides working account/security controls. Route users to the real settings page instead of making placeholders look actionable.
2. Theme is stored in two user-metadata fields (`testdz_theme` and `testdz_language_appearance.theme`). These can drift unless one is declared canonical and the other is migrated/read as compatibility only.
3. Developer dashboard language is browser-local and separate from the account locale. This is acceptable as a workspace preference, but the UI should continue to label that distinction clearly.
4. Account deletion is support-mediated; there is no self-serve deletion workflow in the inspected UI. Do not present it as an available delete action.
5. The active-session list depends on the V2 RPC and has no independently verified browser end-to-end test in this audit. The page handles unavailable data explicitly; device/IP metadata must remain optional.
6. TOTP enrollment is implemented, but this audit did not verify that sensitive operations require an appropriate elevated MFA assurance level. Do not claim MFA enforcement across privileged actions until that policy is separately audited.

### Safe implementation order
- Consolidate the profile page's account/security links into the shared settings route and remove/replace disabled placeholder controls only after route coverage is confirmed.
- Choose one canonical persisted theme/preference representation; preserve existing values during any later migration.
- Verify profile column grants/RLS, avatar Storage owner policies and cleanup behavior with isolated local contract tests.
- Add browser E2E for profile save, avatar upload failure/rollback, email-change confirmation, password change, TOTP enroll/verify/unenroll, sign-out-other-sessions and data export.
- Define account deletion and MFA assurance policy before implementing either as a new privileged workflow.

## 3. Security boundaries

- Never authorize with user-editable `user_metadata`; it is used here only for presentation preferences, not roles or privileges.
- Never permit browser writes to subscription/payment/refund state, wallet balances, plan pricing or privileged profile fields.
- Keep provider secrets and service-role credentials server-side only.
- Do not make hosted database changes, send real payment requests, alter real subscriptions, or deploy Edge Functions as part of this audit.
- Any schema or RPC change must be implemented as a separate candidate migration, tested against disposable local Supabase, and reviewed before any production application.

## 4. Current readiness summary

| Area | Current state | Next gate |
|---|---|---|
| Developer plan display | Read-only, usage-based | Confirm past-due and plan presentation rules |
| Subscription lifecycle | Schema + owner-scoped read only | Provider and lifecycle policy |
| Checkout and webhook | Not implemented | Verified provider contract + local tests |
| Profile editing | Implemented with owner-scoped API | Browser E2E and field validation |
| Password/email/TOTP | Supabase Auth UI operations exist | E2E and MFA assurance policy |
| Sessions | RPC-backed read + sign out other sessions | Verify RPC and browser behavior |
| Theme/language | Persisted in multiple scopes | Canonical preference model |
| Account deletion | Support-mediated only | Approved deletion and retention policy |

**Audit conclusion:** keep Developer billing read-only. The next safe work is account-settings UX consolidation and local verification, while subscription mutations remain blocked until the provider and past-due policy are confirmed.
