# Developer Test Editing and Lifecycle UI — Follow-up Audit

**Audit date:** 2026-11-19  
**Base:** PR #111, commit `89ce19f0c8e133bc2d22627c93627a6a97224a30`  
**Scope:** verify whether existing V2 test-edit API capabilities are reachable from the Developer UI and document lifecycle boundaries.

## Confirmed source findings

### 1. An update RPC wrapper exists, but the main UI does not use it

In `apps/web/src/features/apps/apps-api.ts`, `updateDeveloperTest(testId, input)` calls the `update_test` RPC and passes:
- title
- description
- short summary
- test type
- minimum tester count
- start and end dates
- duration
- tester instructions

In `apps/web/src/modules/developer/pages/DeveloperTestsPage.tsx` on the audited head:
- The import list includes create, submit-for-review, cohort, content, build and asset operations.
- It does **not** import `updateDeveloperTest`.
- The rendered test cards expose submit-for-review for draft/failed/cancelled tests, cohort creation for recruiting/ready tests, and a route to aggregate monitoring.
- There is no test-level edit form or action in the rendered list.
- Cohort editing exists separately, but only while a cohort is `forming`.

Therefore, the existence of an API wrapper must not be reported as a complete end-user edit feature. The main Developer test page currently has no visible path to invoke it.

### 2. Campaign lifecycle is split between test and cohort

The current page supports:
- create test as draft and save ordered steps/requirements
- submit eligible test for administrative review
- create a cohort for recruiting/ready tests
- edit a forming cohort's name, capacity and dates
- transition a cohort through ready, running, completed or cancelled
- upload and verify private APK builds and test assets

These cohort operations do not establish that the parent test can be paused, resumed, edited or cancelled. A cohort transition is not equivalent to a test/campaign transition.

### 3. Monitoring and results are aggregate-only

The V2 monitoring/results pages load owner-scoped summaries and expose aggregate counts, completion, ratings and CSV exports. They explicitly avoid tester names, IDs, individual assignment details and raw feedback text. Keep this privacy boundary intact when restoring campaign management functionality.

## What remains unverified

The frontend wrapper alone does not establish the database-side authorization and lifecycle contract for `update_test`. Before wiring it into UI, inspect the exact candidate/active SQL definition and its contract tests to establish:
1. caller role and ownership checks;
2. allowed test statuses and whether submitted/approved/running tests are immutable;
3. validation and bounds for dates, duration, tester count and enum values;
4. whether edits are audited and whether a reason is required;
5. whether test content steps/requirements must be updated atomically with the base test fields;
6. whether a failed update leaves the prior draft unchanged.

No hosted database was queried or modified for this source-only audit.

## Safe next implementation

1. Locate and review the exact `update_test` SQL definition and tests in the candidate rebuild migrations.
2. If the contract is owner-checked and draft-only, add a draft-only edit action using the existing wrapper; preserve all existing fields and content.
3. If the RPC permits broader statuses or lacks required guards/audit, do not wire it into the UI. Propose a separately reviewed SQL contract change first.
4. Add local disposable DB contract tests for owner mismatch, forbidden statuses, invalid dates/enums/bounds, and atomic failure.
5. Run frontend typecheck/build and manual desktop/mobile/Arabic RTL QA.
6. Keep all PRs Draft and unmerged until explicit user approval.

## Safety

Documentation only. No application source, migration, hosted Supabase, Auth, Storage, data, secrets, Edge Function, cron, or Vercel deployment was changed.
