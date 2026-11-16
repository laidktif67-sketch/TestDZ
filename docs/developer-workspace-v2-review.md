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
- `apps-api.ts` exposes typed RPC wrappers and owner-filtered test reads. `AppDetailPage` can submit an eligible app for review. `DeveloperTestsPage` creates and submits tests creates cohorts after test approval, edits forming cohorts, and advances their lifecycle with audited controls. `DeveloperReviewQueuePage` exposes app/test review only under the admin route guard and requires a review reason. Developer and admin navigation links were connected.
- `tests/005_developer_lifecycle_contract.sql` passed in FixLab. It exercised app submission, non-admin review denial, admin app approval, test creation/submission, developer self-approval denial, admin test approval, cohort creation, tester join, and nine audit events. The final rollback check reported zero synthetic Auth users, profiles, apps, tests, cohorts, and assignments.

## Remaining limitations / acceptance gates

1. Test steps and requirements are exposed in the developer form and tester preview. Cohort update and safe lifecycle transitions are also exposed. APK/test-media upload, cohort assignment analytics, and any manual assignment override remain pending.
2. App and test review decisions are admin-only. Support users can view queues under current RLS but cannot approve or reject; a dedicated support/moderation permission model would need an explicit design if desired.
3. No real browser session has exercised the V2 developer dashboard, submission, review queue, or app icon upload.
4. The app-icon bucket is public-read by design; only mutations are owner-scoped. This is suitable only for public app icons, not private APKs or user evidence.
5. Developer feedback/review screens and role-aware profile presentation still need separate work before claiming the developer workspace is V2-complete.
6. V2 remains opt-in and off by default. Do not enable it in Production until the full acceptance gates pass.
7. Test steps and requirements are now authored through `save_test_content`, which locks the owned test row and only permits draft/failed/cancelled states. It replaces both ordered collections atomically, validates each item and caps each collection at 50. The tester preview reads these collections under the existing participant SELECT policies. The contract also verified that an enrolled tester can read the steps and requirements through RLS.
8. Private APK build upload is implemented through the `test-builds` bucket (50 MB cap, APK MIME only). The developer registers metadata first, uploads to a server-authorized path, and finalizes only after Storage metadata is verified. APK tests cannot be submitted for review until a verified build exists. Testers receive short-lived signed download URLs only after they have an assignment. Do not put APKs in public `app-icons`. Other test media (images/video/documents) remains pending. Cohort editing and safe lifecycle transitions are implemented; manual assignment distribution remains intentionally unavailable.

## Latest private APK build update

- Added `013_private_test_builds.sql` and `014_harden_test_build_storage_helper.sql`; both were applied to FixLab only. The new `test-builds` bucket is private and capped at 50 MB with APK MIME restriction.
- `test_builds` stores version/file metadata and a server-generated storage path. Developers can register only their own editable `apk_testing` test builds. Storage upload policy accepts only the exact pending path. Finalization verifies the stored object's size and MIME before marking it uploaded.
- APK tests are blocked from submission until a verified build exists. Testers can read build metadata and Storage objects only when assigned to that test; the tester preview creates five-minute signed URLs for those participants. No public URL is generated.
- The developer lifecycle contract passed on FixLab, including owner upload authorization, non-owner denial, hiding pending build metadata from testers, verified finalization, submission gate, admin approval, tester enrollment, private object read, and rollback cleanup (zero build rows and zero Storage objects remain).
- Frontend now supports developer APK upload and participant-only download links. Browser/device acceptance and live binary upload through the UI are still pending.

## Latest cohort management update

- Added `012_cohort_management.sql` and applied it to FixLab only. `update_test_cohort` is owner-checked, locks the cohort/test rows, permits edits only while forming, and prevents capacity below the test minimum or existing assignments.
- `transition_test_cohort` permits forming→ready only after the minimum tester count is reached, ready→running, running→completed only after all assignments are terminal, and forming/ready→cancelled only when no assignment is active. Safe cancellation withdraws pending assignments. All changes require a reason and create audit events. Assignment creation remains exclusively through `join_test`, preserving its advisory-lock/capacity logic.
- The developer UI now lists owned cohorts, exposes forming-cohort schedule/capacity/name editing, and offers ready/start/complete/cancel actions.
- The extended lifecycle contract passed on FixLab: non-owner update denied, capacity below test minimum rejected, readiness blocked below minimum tester count, cancellation recorded, pending assignment withdrawn, and all synthetic rows removed by rollback.

## Latest developer content authoring update

- Added candidate SQL `011_test_content_authoring.sql` and applied it to FixLab only.
- Added typed frontend RPC wrapper and developer form fields for ordered steps and requirements. Empty optional rows are omitted; the backend still validates all submitted objects.
- Tester preview now reads developer-authored steps and requirements via the existing RLS-protected tables, with the existing generic preview copy retained when no authored content exists.
- Extended `005_developer_lifecycle_contract.sql`: non-owner write denied, valid step/requirement save succeeds, malformed step rejected, submitted test becomes read-only, audit event is recorded, and rollback leaves zero test steps/requirements. The contract passed on FixLab.

## Verification status

- GitHub readback of changed source files: completed.
- FixLab runtime SQL contracts: PASS. Existing app/profile contracts passed in the earlier round. The new developer lifecycle contract exercised authenticated app submission, non-admin denial, admin app approval, test creation/submission, developer self-approval denial, admin test approval, cohort linking, tester join, audit events, and rejection of attempted app edits while submitted and after publication, and rejection of a cohort smaller than the test's minimum tester count. Its rollback check returned zero synthetic Auth users, profiles, apps, tests, cohorts, and assignments remaining.
- Browser/build verification of the frontend changes: pending.
- Latest GitHub Actions run observed during this review (`43753476783`, commit `00c35da`) failed with the job's `steps` and logs unavailable; therefore it does not establish a TypeScript or Vite build failure or success. Vercel's status still points to the existing `upgradeToPro=build-rate-limit` limit. No claim is made that TypeScript, Vite build, CI, or browser acceptance passed.
