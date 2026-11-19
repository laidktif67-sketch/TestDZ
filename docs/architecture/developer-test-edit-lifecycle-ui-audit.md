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
- The import list does not include `updateDeveloperTest`.
- There is no test-level edit form or action in the rendered list.
- Cohort editing exists separately, but only while a cohort is `forming`.

Therefore, the API wrapper is not a complete end-user edit feature. The main Developer test page currently has no visible path to invoke it.

### 2. The SQL contract has now been located and inspected

The definition is in candidate migration `supabase/rebuild-v2/008_developer_lifecycle.sql`, function `rebuild_v2_private.update_test_impl`, exposed through `rebuild_v2.update_test`.

Confirmed guards and behavior:
- Requires an authenticated caller.
- Requires the `developer` or `admin` role.
- The UPDATE predicate requires `tests.developer_id = auth.uid()`; thus even an Admin caller cannot use this function to edit another developer's test through this path.
- Only `draft`, `failed`, and `cancelled` tests are editable.
- Validates title length (3–160), description length (20–12000), supported test type, minimum testers (1–500), date order, duration (1–1440 minutes), and instructions length (maximum 12000).
- Updates the base test fields and `updated_at`.
- Appends an immutable audit event `test.updated` with actor and target. The reason is a fixed generic message, not a caller-supplied reason.
- The update and audit insert run in the same database function transaction; an exception rolls the function call back.

The wrapper accepts no `appId`, so this edit path does not move a test to another app. The SQL does not update ordered test steps, requirements, or the six-step `test_config`; these are separate concerns and must not be silently overwritten by a base-fields edit.

### 3. Contract-test coverage gap

The candidate test directory contains contracts through `028_developer_test_invitations_contract.sql`, including the six-step config, monitoring privacy, support-role and invitation contracts. No dedicated contract test for `update_test` was found in the inspected candidate test set.

This is a test-coverage gap, not proof that the function is unsafe. Before UI integration, add isolated local-database tests for:
1. owner can edit an eligible draft;
2. another developer cannot edit it;
3. Admin cannot use this owner-bound function to edit a different developer's test;
4. submitted, approved, recruiting, ready, running and completed statuses are rejected;
5. failed/cancelled eligible states are accepted;
6. invalid title, description, enum, tester count, dates, duration and oversized instructions are rejected;
7. failed validation leaves all fields unchanged and emits no successful audit event;
8. successful update writes the expected audit actor, action and target.

### 4. Campaign lifecycle is split between test and cohort

The current page supports:
- create test as draft and save ordered steps/requirements
- submit eligible test for administrative review
- create a cohort for recruiting/ready tests
- edit a forming cohort's name, capacity and dates
- transition a cohort through ready, running, completed or cancelled
- upload and verify private APK builds and test assets

These cohort operations do not establish that the parent test can be paused, resumed, edited or cancelled. A cohort transition is not equivalent to a test/campaign transition.

### 5. Monitoring and results are aggregate-only

The V2 monitoring/results pages load owner-scoped summaries and expose aggregate counts, completion, ratings and CSV exports. They explicitly avoid tester names, IDs, individual assignment details and raw feedback text. Keep this privacy boundary intact when restoring campaign management functionality.

## Safe next implementation

1. Add the missing `update_test` local contract tests before UI wiring; do not change the existing RPC contract casually.
2. Add a draft/failed/cancelled-only edit action using the existing wrapper, with a clear status gate and preservation of test steps, requirements and `test_config`.
3. Verify all edits use the existing owner-scoped RPC; do not add direct table writes or broaden Admin ownership.
4. Run isolated local DB contract tests, frontend typecheck/build, and manual desktop/mobile/Arabic RTL QA.
5. Keep all PRs Draft and unmerged until explicit user approval.

## Safety

Documentation-only follow-up. No application source, migration, hosted Supabase, Auth, Storage, data, secrets, Edge Function, cron, or Vercel deployment was changed.
