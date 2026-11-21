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
| Distribution method and distribution URL | Explicitly displayed; URL can be opened/copied | Read-only method and URL are loaded and displayed; URL can be opened | Core distribution context is now preserved. A dedicated copy-link control is not present in the current V2 page. |
| Related tests | Inline list with status and created/start/end dates, links to each test detail | Owner-filtered inline list with status and created/start/end dates; links to per-test monitoring | Core per-app related-test context is now preserved. V2 routes to aggregate monitoring rather than the legacy individual campaign-detail route. |
| Version history | Explicit placeholder says version tracking is not available in the data model | No equivalent section | No version data should be invented; an explicit future/unsupported state is optional. |
| Review lifecycle | Legacy screen predates current V2 review gate | V2 submit-for-review and submitted/published restrictions | V2 review flow is an improvement and must remain. |

**Verified current disposition:** the current V2 `AppDetailPage` already displays read-only distribution metadata and an owner-filtered related-tests section. `getAppById` selects `distribution_method`/`distribution_url` and filters by both app ID and authenticated developer ID; `listDeveloperTestsForApp` filters by both app ID and developer ID, with RLS remaining authoritative. Keep the V2 review restrictions. A copy-link affordance is a small optional parity improvement, not a blocker. Do not create a version-history table until a real version model and lifecycle are designed.

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
4. Does the current per-app related-tests section need pagination if app test counts grow, or is the current bounded UI sufficient?
5. Which legacy activity events have safe aggregate equivalents, and which should remain unavailable due to tester privacy?

These are source/API contract questions; do not implement client-side writes or infer support from a button or status label.

## 4. Safe implementation sequence

1. Add back V2 app-list search/filter/sort/layout controls without changing persistence or schema.
2. Keep the existing read-only distribution metadata and owner-filtered related-tests section in AppDetailPage; consider adding a copy-link affordance after UX QA.
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


## 5. Verified V2 campaign lifecycle contract (2026-11-21)

The follow-up source inspection resolves the campaign pause/resume question for the current V2 candidate:

- rebuild_v2.tests.status permits: draft, submitted, recruiting, ready, running, at_risk, completed, failed, and cancelled. There is no paused test status.
- rebuild_v2.cohorts.status permits: forming, ready, running, completed, and cancelled. There is no paused cohort status.
- The candidate RPC rebuild_v2.transition_test_cohort(p_cohort_id, p_new_status, p_reason) is owner-scoped (cohort created_by=auth.uid()), locks the cohort/test/assignments, and writes an audit event with the supplied reason.
- Supported cohort transitions are narrowly defined:
  - forming → ready: requires an approved/published app, a recruiting/ready linked test, and the test's minimum tester count.
  - ready → running.
  - running → completed: blocked while any assignment is pending or active; the linked test completes only when no other forming/ready/running cohort remains.
  - forming|ready → cancelled: blocked if active assignments exist; pending assignments are withdrawn.
  - Other transitions fail closed.
- The Developer Tests UI calls this cohort RPC for ready/running/completed/cancelled. This is cohort management, not a test-wide pause/resume/end API.
- App status separately includes paused, but that is the app lifecycle and must not be repurposed as a test/campaign pause switch.

**Conclusion:** the current candidate has no safe test-level pause/resume operation and no distinct campaign-level end operation. Do not add buttons that mutate tests.status directly, and do not map pause/resume to app pause or cohort cancellation. A future campaign pause/resume feature needs an explicit lifecycle design (including what happens to active assignments, recruitment visibility, linked cohorts, notifications, and audit reasons), schema/status compatibility, an owner-checked transactional RPC, and contract tests before UI work.

### Contract evidence inspected

- supabase/rebuild-v2/001_schema.sql — tests/cohorts status constraints.
- supabase/rebuild-v2/012_cohort_management.sql — transition_test_cohort_impl, public wrapper, role/ownership checks, transition guards, audit event.
- apps/web/src/modules/developer/pages/DeveloperTestsPage.tsx — visible cohort transition actions and calls to transitionDeveloperTestCohort.
- apps/web/src/features/apps/apps-api.ts — client wrapper surface should remain cohort-specific; no test-wide pause/resume wrapper was identified in the inspected Developer Tests imports.

This is a source-contract finding only. No SQL, app code, database, hosted service, or deployment was changed by this audit update.


## 6. Verified results-page parity and privacy review (2026-11-21)

A direct source comparison was completed between the legacy DeveloperTestResultsPage and the V2 DeveloperTestResultsPage, plus the V2 monitoring RPC and its privacy contract.

| Capability | Legacy results page | V2 results page | Finding |
|---|---|---|---|
| Overall totals and status breakdown | Assignment rows loaded directly and classified client-side | Aggregated per-test monitoring summaries | V2 avoids exposing raw assignment rows. |
| Date range (7/30/90/all) | Client-side filter over assignment created_at | No global date-range filter | Missing in V2; cannot be reconstructed accurately from the current seven-day-only dailyActivity field. |
| App/test/status filters | Present | Test title/app search and test-status filter | V2 has search and test-status filter; no separate app selector or assignment-outcome filter. |
| Trend chart | Seven-day assignment-created trend with completion ratio and run counts | Per-test seven-day activity counts in monitoring page; no cross-test chart on Results page | Not equivalent: monitoring dailyActivity counts multiple event types, not completed runs or success rate. Do not relabel it as a success trend. |
| Recent results table | Individual assignment rows with date, test, app and outcome | Per-test aggregate table | Individual rows are intentionally not exposed in V2. |
| Average rating | Calculated from feedback ratings | Weighted correctly from averageRating × ratingCount across test summaries | Aggregate insight retained. |
| Unique testers | Calculated from tester IDs across selected assignment rows | Unique tester count is available per test only | Do not sum per-test uniqueTesters to claim a global unique count; the same tester may appear in multiple tests. |
| Repeat-run share | Derived from tester IDs across raw rows | Not exposed | Cannot be reconstructed safely from current aggregate response. |
| CSV export | Included tester_id in exported rows | Per-test aggregate summary only | V2 is safer; do not restore tester identifiers. |

### Verified V2 data contract

- The existing owner-scoped RPC get_developer_test_monitoring returns test metadata, test configuration, assignment-state counts, feedback/rating aggregates, and dailyActivity.
- The SQL computes dailyActivity from assignment, start, completion, check-in, and feedback event timestamps. It emits a day only when at least three distinct testers contributed events that day. Its count is an event count, not an assignment count or completion count.
- The monitoring privacy contract explicitly asserts that tester IDs, assignment IDs, check-in notes, evidence paths, raw feedback bodies, and raw assignment/check-in/feedback rows are not exposed to a Developer. It also checks that another Developer and a Tester cannot read the target test's monitoring response.
- The current V2 Results page aggregates total assignments, completed, failed, active, pending, feedback count, and a rating average weighted by ratingCount. It correctly does not attempt to sum uniqueTesters across tests.

### Safe parity decisions

1. Keep V2 aggregate-only results and aggregate CSV export. Never reintroduce tester IDs, names, avatars, assignment IDs, raw feedback bodies, check-in notes, or evidence paths into Developer results.
2. Do not add a global date-range selector until the backend exposes date-bounded aggregate counts with a clear definition (assignment creation vs completion vs activity) and privacy thresholds.
3. Do not build a global completion/success trend from dailyActivity. A future trend requires an explicit owner-scoped RPC returning date-bucketed assignment outcomes, with privacy suppression and SQL contract tests.
4. An app selector can be added safely as a client-side filter over the already loaded owned-test summaries, without extra data access. An assignment-outcome filter is not equivalent to test-status filtering and should not be added until the summary exposes a well-defined outcome distribution (including withdrawn/rejected semantics).
5. Do not restore repeat-run share or global unique tester totals from per-test counts; deduplicating across tests would require privacy-reviewed aggregate backend support.
6. A safe near-term UI enhancement is an explicit per-test activity view using the existing seven-day activity data, clearly labeled as activity events and retaining the SQL minimum-three-distinct-testers suppression. The existing per-test Monitoring page already renders this information.

### Source evidence inspected

- Legacy apps/web/src/modules/developer/pages/DeveloperTestResultsPage.tsx — assignment-based filters, seven-day trend, recent rows, unique tester/repeat-run metrics and CSV containing tester_id.
- Legacy apps/web/src/modules/developer/pages/DeveloperTestCampaignDetailsPage.tsx — individual tester and feedback identity/content in campaign detail.
- V2 apps/web/src/modules/developer/pages/DeveloperTestResultsPage.tsx — per-test summary aggregation, weighted rating, filters, aggregate CSV and privacy notice.
- V2 apps/web/src/modules/developer/pages/DeveloperTestMonitoringPage.tsx — per-test activity chart and aggregate metrics.
- V2 apps/web/src/features/apps/apps-api.ts — DeveloperTestMonitoringSummary and getDeveloperTestMonitoringSummary wrapper.
- supabase/rebuild-v2/030_developer_test_monitoring_summary.sql — owner check, aggregate metrics, daily event grouping and threshold.
- supabase/rebuild-v2/tests/026_developer_test_monitoring_privacy_contract.sql — aggregate correctness, minimum-three-distinct-testers threshold, and private-data non-disclosure assertions.

This comparison was documentation-only. No app code, SQL, database, hosted service, or deployment was changed.


## 7. App-detail source verification and monitoring edge cases (2026-11-21)

The earlier app-detail gap statement above was rechecked against the current V2 stack after PR #116. It is now superseded by the verified implementation:

- `AppDetailPage` calls `getAppById(id, userData.user.id)`; the API selects `distribution_method` and `distribution_url` and applies both app-ID and developer-ID filters.
- The page displays the distribution method and an external link when configured. It does not currently provide a copy-link action.
- The page calls `listDeveloperTestsForApp(id, userData.user.id)`; that query selects only the selected app's tests for that developer and orders them newest first. The related-test rows show title, status, start/end dates (or created date) and link to `/developer/tests/:id/monitoring`.
- The monitoring route is mounted in `apps/web/src/App.tsx`. The RPC implementation independently checks the Developer role and exact test ownership before returning data; the app/test RLS policies also retain owner checks.
- This means the core related-test and distribution context are already restored in the current V2 page. The legacy campaign-detail route itself remains intentionally replaced by a monitoring route plus separate Developer workspace pages.

### Two monitoring presentation issues found

1. **Timezone key mismatch:** SQL buckets `dailyActivity.date` in `Africa/Algiers`, while `DeveloperTestMonitoringPage` creates its seven date keys using the browser's local `Date` getters. If a Developer's device timezone is not Algeria, SQL and browser day keys can differ and the activity may appear under the wrong day or as zero. The UI should use an explicit `Africa/Algiers` date-key formatter (or the API should return a clearly defined timezone and the UI must honor it).
2. **Feedback count label:** SQL `feedbackCount` counts all feedback rows, while `ratingCount` counts only rows with a non-null rating. The Results and Monitoring pages currently label `feedbackCount` as received ratings/evaluations. The label should say feedback submissions/records; use `ratingCount` when the UI means star ratings.

### Safe follow-up

- Correct the timezone key generation and add a deterministic test for a non-Algeria browser timezone.
- Correct the UI labels to distinguish feedback submissions from rated feedback; preserve the separate average-rating calculation.
- Keep the current owner-filtered related-test query. Add pagination only if real app test volume and UX evidence justify it.
- Do not add new data queries or expose tester-level details for these presentation fixes.

### Source evidence inspected

- V2 `apps/web/src/pages/AppDetailPage.tsx`.
- V2 `apps/web/src/features/apps/apps-api.ts` — `getAppById` and `listDeveloperTestsForApp`.
- V2 `apps/web/src/modules/developer/pages/DeveloperTestMonitoringPage.tsx`.
- V2 `apps/web/src/modules/developer/pages/DeveloperTestResultsPage.tsx`.
- V2 `supabase/rebuild-v2/002_security.sql` — app/test owner-read policies.
- V2 `supabase/rebuild-v2/030_developer_test_monitoring_summary.sql` — Algiers daily buckets and separate feedback/rating counts.

This update is documentation-only. No application code, SQL, database, hosted service, or deployment was changed.
