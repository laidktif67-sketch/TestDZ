# Developer workspace V2 integration review

Date: 2026-11-15
Branch: `rebuild/testdz-v2`

## Scope and safety

This review covered the developer dashboard, app list/detail pages, shared app API, app lifecycle candidate SQL, app RLS, and app-icon Storage policies. Source changes were made on the V2 development branch. Candidate migrations `008_developer_lifecycle.sql`, `009_lock_app_edits_during_review.sql`, and `010_guard_test_cohort_capacity.sql` were applied to isolated TestDZ-FixLab only; no Production schema/data, Auth users, Storage objects, Vercel settings, or PR #18 were changed. Runtime contract fixtures were transaction-scoped and rolled back.

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

## Implemented in this round

- `008_developer_lifecycle.sql` adds owner-checked `submit_app_for_review`, admin-only `review_app`, developer `create_test` / `update_test` / `submit_test_for_review`, admin-only `review_test`, and developer `create_test_cohort` RPCs. Every state transition records an immutable audit event with the actor and decision reason where applicable.
- `009_lock_app_edits_during_review.sql` tightens `update_app`: only draft/rejected apps can be edited. The V2 app detail UI also disables edits during review and after publication, avoiding an unreviewed metadata change on a published app.
- `010_guard_test_cohort_capacity.sql` requires the parent app to remain published and cohort capacity to meet or exceed the test's `min_testers` before creating the cohort. The UI defaults cohort capacity to that minimum.
- The test authoring RPCs require an owned published app. Test approval moves the test into `recruiting`; cohort creation links it to a forming cohort. This unlocks the existing `join_test` flow.
- `apps-api.ts` exposes typed RPC wrappers and owner-filtered test reads. `AppDetailPage` can submit an eligible app for review. `DeveloperTestsPage` creates and submits tests and creates cohorts after test approval. `DeveloperReviewQueuePage` exposes app/test review only under the admin route guard and requires a review reason. Developer and admin navigation links were connected.
- `tests/005_developer_lifecycle_contract.sql` passed in FixLab. It exercised app submission, non-admin review denial, admin app approval, test creation/submission, developer self-approval denial, admin test approval, cohort creation, tester join, and six audit events. The final rollback check reported zero synthetic Auth users, profiles, apps, tests, cohorts, and assignments.

## Remaining limitations / acceptance gates

1. Test steps, requirements, media/APK upload, and cohort update/close/assignment management are not yet exposed by these RPCs or the developer UI. The first usable V2 flow currently supports basic test metadata and cohort creation only.
2. App and test review decisions are admin-only. Support users can view queues under current RLS but cannot approve or reject; a dedicated support/moderation permission model would need an explicit design if desired.
3. No real browser session has exercised the V2 developer dashboard, submission, review queue, or app icon upload.
4. The app-icon bucket is public-read by design; only mutations are owner-scoped. This is suitable only for public app icons, not private APKs or user evidence.
5. Developer feedback/review screens and role-aware profile presentation still need separate work before claiming the developer workspace is V2-complete.
6. V2 remains opt-in and off by default. Do not enable it in Production until the full acceptance gates pass.

## Verification status

- GitHub readback of changed source files: completed.
- FixLab runtime SQL contracts: PASS. Existing app/profile contracts passed in the earlier round. The new developer lifecycle contract exercised authenticated app submission, non-admin denial, admin app approval, test creation/submission, developer self-approval denial, admin test approval, cohort linking, tester join, audit events, and rejection of attempted app edits while submitted and after publication, and rejection of a cohort smaller than the test's minimum tester count. Its rollback check returned zero synthetic Auth users, profiles, apps, tests, cohorts, and assignments remaining.
- Browser/build verification of the frontend changes: pending.
- Latest GitHub Actions run observed during this review (`43753346575`, commit `037fa3c`) failed with the job's `steps` and logs unavailable; therefore it does not establish a TypeScript or Vite build failure or success. Vercel's status still points to the existing `upgradeToPro=build-rate-limit` limit. No claim is made that TypeScript, Vite build, CI, or browser acceptance passed.
