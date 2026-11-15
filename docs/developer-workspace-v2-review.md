# Developer workspace V2 integration review

Date: 2026-11-15
Branch: `rebuild/testdz-v2`

## Scope and safety

This review covered the developer dashboard, app list/detail pages, shared app API, app lifecycle candidate SQL, app RLS, and app-icon Storage policies. Source changes were made on the V2 development branch. No schema migration or DDL was applied; only transaction-scoped FixLab contract tests were executed and rolled back. No persistent database/Auth/Storage data was changed, and Production/Vercel/PR #18 were not touched.

## Confirmed integration gap

The V2 candidate already defines:
- `rebuild_v2.apps` with the developer-owned app model and lifecycle statuses `draft`, `submitted`, `published`, `paused`, `archived`, and `rejected`.
- `get_app_limit`, `create_app`, `update_app`, `archive_app`, and `restore_app` RPC wrappers.
- Owner-scoped app SELECT RLS, with published apps visible to authenticated users and staff visibility limited to admin/support.
- An `app-icons` public-read bucket with owner-only object mutations enforced by `rebuild_v2_private.can_manage_app_icon`.

Before this change, `apps-api.ts` called the default `public` schema for app reads and lifecycle RPCs even when the V2 feature flag was enabled. The developer dashboard also read its profile from `public.profiles`. In addition, the V2 app SELECT policy intentionally permits authenticated reads of published apps, but the developer workspace had no `developer_id` filter, so the "My Apps" list and dashboard could mix other developers' published apps into the owner's workspace.

## Source changes made

- `apps/web/src/features/apps/apps-api.ts`: app list/detail reads and quota/create/update/archive/restore RPCs now select `supabaseV2` when `VITE_TESTER_WORKFLOW_V2_ENABLED=true`; otherwise they preserve the legacy `public` client. List/detail queries now also require the current developer ID, preventing published apps belonging to other developers from appearing in the owner's workspace. Storage upload remains on the base Supabase Storage client, because Storage buckets are not schema-scoped.
- `apps/web/src/modules/developer/pages/DeveloperDashboardPage.tsx`: profile reads use the same selected data schema while Auth session handling remains on the base client; app metrics are scoped to the signed-in developer.
- `apps/web/src/features/profiles/profiles-api.ts`: profile reads, profile updates, onboarding status/completion, and avatar profile-link updates now use the V2 data client when enabled. Avatar file upload/list/delete still use the base Storage client, with V2 owner-scoped `avatars` policies.
- `packages/types/src/apps.ts`: shared app status type now includes V2 `submitted` and `rejected` statuses.
- `apps/web/src/pages/AppsPage.tsx` and `AppDetailPage.tsx`: display labels now distinguish submitted/rejected apps rather than incorrectly presenting them as drafts; app details are fetched only for the signed-in owner.

## Remaining limitations / acceptance gates

1. The V2 app lifecycle SQL currently provides create, update, archive, restore, and quota RPCs. It does not provide a developer-facing submit-for-review or publish RPC/UI flow. No publish action was invented or exposed.
2. Structural/security assertions in `tests/security_contract.sql` are complemented by the new FixLab runtime contract `tests/003_app_lifecycle_contract.sql`, which passed for authenticated create, ownership isolation, quota enforcement, update/archive/restore, and app-icon helper authorization.
3. No real browser session has exercised the V2 developer dashboard or app icon upload.
4. The app-icon bucket is public-read by design; only mutations are owner-scoped. This is suitable only for public app icons, not private APKs or user evidence.
5. Developer test creation/management is not implemented in the current V2 backend: the candidate migrations expose no developer RPCs to create/update/submit tests or manage cohorts, while direct table writes are revoked and the tests/cohorts policies shown are read-only. The current app detail page also labels test management as coming soon; no developer test-management route is registered. Developer feedback/review screens likewise need a separate workflow audit before claiming the developer workspace is V2-complete. The shared `/profile` route now uses V2 data but still presents tester-specific ID/stat labels for developer-only accounts; the profile presentation should become role-aware.
6. V2 remains opt-in and off by default. Do not enable it in Production until the full acceptance gates pass.

## Verification status

- GitHub readback of changed source files: completed.
- FixLab runtime SQL contracts: PASS. The app lifecycle test exercised authenticated app creation, owner read/update, active-app quota enforcement, archive/restore quota accounting, cross-developer draft visibility isolation, cross-user update/archive rejection, and owner-only app-icon helper access. The profile test exercised self-only reads/updates, allowed profile columns, and denied writes to verification/ban flags. Both transactions rolled back with zero synthetic Auth users, profiles, or app rows remaining.
- Browser/build verification of the frontend changes: pending.
- No claim is made that TypeScript, Vite build, CI, or browser acceptance passed.
