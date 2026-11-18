# Developer Workspace — App and Campaign Field/Action Parity Audit

**Audit date:** 2026-11-18  
**Repository:** `laidktif67-sketch/TestDZ`  
**Legacy reference:** `feat/developer-create-test-six-step`  
**V2 reference:** `fix/developer-six-step-helper-copy` (stacked after PR #110)  
**Scope:** source-level comparison of legacy app list/detail and test list/campaign detail against mounted V2 pages, routes and visible actions.

## Executive finding

The Developer workspace has broad V2 coverage, but the app and campaign experiences are not yet field/action-equivalent to the legacy workspace. The current V2 intentionally consolidates several legacy pages and uses privacy-minimized aggregate data. That is not a reason to reintroduce legacy screens wholesale. Preserve useful operational information and actions only where they have a clear V2 contract and safe authorization boundary.

This audit is documentation-only. No application code, SQL, migration, hosted Supabase, Auth, Storage, secret, Edge Function, cron, or deployment was changed.

## Sources inspected

- Legacy `DeveloperAppsPage.tsx`, `DeveloperAppDetailPage.tsx`, `DeveloperMyTestsPage.tsx`, and `DeveloperTestCampaignDetailsPage.tsx` on `feat/developer-create-test-six-step`.
- V2 `apps/web/src/pages/AppsPage.tsx`, `apps/web/src/pages/AppDetailPage.tsx`, `modules/developer/pages/DeveloperTestsPage.tsx`, `DeveloperTestMonitoringPage.tsx`, and `DeveloperTestersPage.tsx`.
- V2 route registration in `apps/web/src/App.tsx` on the current Developer stack.

## 1. App list parity

| Capability / field | Legacy app list | Current V2 app list | Finding |
|---|---|---|---|
| App name and package ID | Displayed; both searchable | Displayed; name search only | Package ID search is absent in V2 UI. |
| Description | Included in search | Not included in search | Search coverage is narrower. |
| Status filters | All, published, draft, paused, archived | All, active, archived | Published/draft/paused distinctions are not independently filterable in V2. |
| Sorting | Latest, oldest, name | No visible sort control | Useful list management control is missing. |
| Grid/list layout | Both layouts | Grid only | List density option is missing. |
| Per-app metrics | Test count, distinct tester count and average rating | No per-app metrics on list | Metrics were removed from the list surface; do not restore them with unbounded/raw tester queries. |
| Plan limit | Current app limit and create eligibility | Current app limit and create eligibility | Preserved. |
| Create app | App metadata and icon upload | App metadata and icon upload | Core create capability preserved. |

**Recommended disposition:** retain the current V2 list and add back the useful list controls (status filters, sort, optional compact/list layout, package/description search) after visual QA. Treat per-app metrics as a separate privacy-reviewed aggregate enhancement; never expose tester identities or raw feedback merely to calculate cards.

## 2. App detail parity

| Capability / field | Legacy app detail | Current V2 app detail | Finding |
|---|---|---|---|
| App name, package ID, category, description, status, created date | Present | Present | Core information preserved. |
| Edit app metadata | Name, category, description | Name, category, description | Preserved for permitted statuses. |
| Archive / restore | Both actions | Both actions | Preserved. |
| Distribution method and distribution URL | Explicitly displayed; URL can be opened/copied | Not displayed in current V2 detail page | Important app-distribution context is absent from the page. |
| Related tests | Inline list with status and created/start/end dates, links to each test detail | Link to general Developer tests page | Per-app related-test context is absent. |
| Version history | Explicit placeholder says version tracking is not available in the data model | No equivalent section | No version data should be invented; an explicit future/unsupported state is optional. |
| Review lifecycle | Legacy screen predates current V2 review gate | V2 submit-for-review and submitted/published restrictions | V2 review flow is an improvement and must remain. |

**Recommended disposition:** restore read-only distribution metadata and an owner-scoped related-tests section in V2. Keep the existing V2 review restrictions. Do not create a version-history table until a real version model and lifecycle are designed.

## 3. Test list and campaign detail parity

Legacy `DeveloperMyTestsPage` and `DeveloperTestCampaignDetailsPage` provide a distinct campaign-details route with these visible functions:

- Campaign identity, app identity, status, creation date, start/end dates, duration and target tester count.
- Edit title, description, dates and target tester count.
- Pause/resume recruitment and end/cancel the campaign.
- Overview with progress, completed/active/pending counts and cohort capacity.
- Tester list and completion state.
- Results summary and completion rate.
- Feedback list and ratings.
- Recent activity timeline.

Current V2 is deliberately split across:
- `/developer-tests` — consolidated test lifecycle list, creation, content, APK/build and asset uploads, cohort creation/edit/transition.
- `/developer/tests/:id/monitoring` — owner-checked aggregate monitoring, status metrics, daily activity and CSV summary.
- `/developer/testers` — aggregate tester/community metrics plus invitation management.
- `/developer-test-results` — dedicated results workspace.
- `/developer-feedback` — feedback list and selected-detail pane with review status, priority, resolution note and internal notes.

There is no mounted V2 `/developer/tests/:id` campaign-details route. Do not describe the split pages as a complete one-to-one replacement for every legacy campaign action without checking the actual API contracts.

### Intentional privacy change

The legacy campaign details page rendered tester display names, avatar URLs and tester IDs in campaign tester lists and activity text. The current V2 monitoring/tester surfaces are designed around aggregate, privacy-minimized data. This is an intentional privacy boundary, not a missing feature to reproduce. Keep individual tester identity, private assignment details and raw activity out of Developer analytics unless a separately reviewed product requirement and authorization contract explicitly permits a narrowly scoped disclosure.

### Remaining parity questions to resolve

1. Does V2 provide a safe owner-scoped way to update campaign title/description/date/target after creation, or are those values intentionally frozen in the draft/review lifecycle?
2. Is there a supported campaign-level pause/resume/end operation, distinct from transitioning an individual cohort?
3. Does the results workspace expose all campaign-level outcome fields that were shown in the legacy Results tab?
4. Can the app detail page query only the selected owner's related tests without duplicating list-wide queries?
5. Which legacy activity events have safe aggregate equivalents, and which should remain unavailable due to tester privacy?

These are source/API contract questions; do not implement client-side writes or infer support from a button or status label.

## 4. Safe implementation sequence

1. Add back V2 app-list search/filter/sort/layout controls without changing persistence or schema.
2. Add read-only distribution method/link and a related-tests summary to AppDetailPage using existing owner-scoped APIs.
3. Inspect V2 test/cohort RPC contracts for campaign edit and recruitment lifecycle before proposing UI controls.
4. Map legacy campaign summary fields to existing monitoring/results RPC output; document any field with no safe destination.
5. Keep tester identity minimized; do not port legacy names, avatars, tester IDs or raw activity to Developer pages.
6. Run frontend typecheck/build, relevant local disposable DB contracts, and manual desktop/mobile/Arabic RTL browser QA before treating parity as complete.

## Safety and release gates

- This PR contains documentation only.
- All PRs remain Draft and unmerged until the user explicitly approves merging.
- No hosted Supabase migration or data mutation, Storage/Auth change, secret, Edge deployment, cron, Vercel Preview or Production deployment was performed or authorized.
- Do not merge legacy Developer branches wholesale.
- Do not claim CI or browser QA passed unless exact-head workflow/browser evidence is recorded.
