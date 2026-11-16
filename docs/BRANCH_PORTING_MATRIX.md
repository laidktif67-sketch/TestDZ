# TestDZ Branch and Feature Porting Matrix

**Reviewed:** 2026-11-16  
**Candidate baseline:** `rebuild/testdz-v2` — `54c36b5a9d9fcaae5bdc118921b7b5eb142ba9bc`  
**Purpose:** Identify useful work in open PRs and side branches without merging incompatible histories.

## Current GitHub inventory

- Repository visibility: Public.
- Default branch: `main`.
- Remote branches returned by GitHub: 47.
- Open pull requests returned by GitHub: 27; all are Draft.
- Branch protection: none of the 47 listed branches is protected.
- V2 remains the candidate consolidation baseline, not yet the default branch or a production-ready release.

## Feature porting decisions

| Source PR / branch | Work found | V2 evidence | Decision |
|---|---|---|---|
| #42 `chore/v2-agent-governance` | Repository-wide agent rules, engineering roles, consolidation plan | Three documentation files on a V2-based branch | Keep as governance PR; review and merge separately |
| #33 `feat/developer-create-test-six-step` | Six-step developer wizard, test configuration JSON, app distribution metadata/RPC, draft creation | V2 already has `DeveloperTestsPage`, `test_type`, `create_test` / `update_test` API contracts and modular `apps-api`; no `test_config` contract found in V2 API | Reuse UX/product requirements, but redesign wizard against V2 schema/RPCs; do not port its `public.*` migrations |
| #32 `feat/admin-dashboard-overview` | Large admin workspace: users, apps, tests, assignments, financial ledger, support, medical exceptions, audit trail, withdrawals | V2 `modules/admin/README.md` is a placeholder stating admin pages are reserved; `App.tsx` only routes `/admin` to generic `TesterSectionPage` and `/admin/developer-reviews` to `DeveloperReviewQueuePage`; no admin feature pages exist | Major V2 feature gap. Inventory route and permission requirements, then implement V2-native admin module in small slices; do not copy the 74-file legacy implementation wholesale |
| #31 `feat/developer-report-review` | Developer review of tester reports | V2 has `DeveloperReviewQueuePage` and feature APIs; exact parity of review detail/actions not yet proven | Compare workflows and contracts; port only missing states/actions after checking V2 RPC authorization |
| #30 `feat/tester-assignment-report-submission` | Legacy `assignment_submissions` table, evidence storage, submit RPC | V2 already has `AssignmentSubmissionPage` and modular API for draft creation, attachment registration, and finalization | Capability is substantially represented in V2. Prefer V2's staged server workflow; do not port legacy table/RPC migration |
| #29 `feat/tester-daily-checkin-rpc` | Legacy server-authoritative check-in RPC; derives date in Africa/Algiers; also awards 2 points and updates `wallets` | V2 page calls `submit_checkin` through `assignments-api.ts` | Preserve server-authoritative date/idempotency requirements, but do not port its legacy SQL or reward posting. Reward posting remains gated and needs separate ledger/business approval |
| #28 `feat/admin-account-suspension-appeals` | Admin suspension and seven-day appeals schema/tests | V2 admin module is not implemented; current ban enforcement/appeal parity is unverified | Product/security requirement to port after defining V2-native suspension and appeal authorization; do not port public-schema SQL |
| #27 `fix/banned-account-enforcement` | Adds restrictive policies and triggers across every legacy public table and Storage | V2 identity API does not currently expose an account-status check; earlier FixLab review found ban enforcement coverage incomplete | High-priority security gap. Design explicit V2 private-schema guard/RPC policy and AuthGuard fail-closed UX; do not copy broad legacy dynamic policy migration |
| #26 `fix/medical-exception-date-schema` | Medical exception requested-date schema and validation | V2 has medical exception decision audit and Algeria date validation migrations | Likely partially included; compare exact V2 columns, constraints, UI and RPCs before porting anything |
| #25 `fix/pr23-support-ticket-migration-history` | Support-ticket migration filename/history reconciliation | V2 includes support ticket and conversation migrations | Treat as migration provenance/history evidence, not as a feature migration to apply blindly |
| #23 `feature/developer-my-tests-dashboard` | Large dashboard UI refinement | V2 has `DeveloperTestsPage` | Compare screen states and API behavior; port selected UI improvements only |
| #22 `feature/developer-my-tests-reference` | Developer My Tests reference page | V2 has `DeveloperTestsPage` | Compare mockup coverage and routes; do not replace V2 module wholesale |
| #19 `fix/unify-tester-sidebar` | Shared tester sidebar unification | V2 has `modules/tester/components/TesterSidebar.tsx` and multiple pages use it | Functionality appears incorporated; verify remaining visual differences before closing |
| #18 `integrate/pr17-into-architecture` | Tester experience integration into architecture-v1 | PR #18 head is an ancestor of V2 | Historical reference only; leave open and unchanged |
| #17, #16, #14, #13 | Older tester discover/dashboard, medical exception, landing/auth UI work | V2 contains tester pages, medical-exception migrations, and current auth routes | Treat as design/reference history; verify route and behavior gaps rather than merging old branches |

## Confirmed V2 migration provenance blocker

The current V2 branch contains 31 committed files in `supabase/migrations/`, ending at `20261112000100_support_ticket_conversations.sql`.

A content scan of all 31 committed migration files found no definitions for these RPCs/contracts called by V2 frontend code:
- `create_test`
- `update_test`
- `save_test_content`
- `submit_checkin`
- `create_assignment_submission`
- `register_assignment_submission_attachment`
- `finalize_assignment_submission`

The scan also found no definitions for the V2 frontend's `create_test`, `update_test`, `save_test_content`, `submit_checkin`, `create_assignment_submission`, `register_assignment_submission_attachment`, or `finalize_assignment_submission` RPCs. It found no definitions for the later branch's `test_config`, `create_app_with_distribution`, or `is_current_user_banned` contracts.

The scan covered all 31 committed V2 SQL migration files at the baseline SHA. This does **not** prove those routines are absent from the FixLab database; prior FixLab inspection found a candidate V2 schema with 39 exposed-schema functions and 57 private-schema functions. It proves the current Git migration history is not sufficient to reconstruct all runtime contracts from scratch. Recover the exact SQL definitions from the isolated FixLab source/schema and map them to versioned migrations before any database replay or cutover.

## Security and workflow cautions

1. PR #29's legacy check-in migration writes to the tester points ledger and `wallets`. Do not port reward posting as part of the check-in fix. Keep rewards and withdrawals gated.
2. PR #27's migration loops through every legacy `public` table and adds restrictive policies plus triggers. V2's shared `AuthGuard` currently has no account-status verification; the V2 identity API has no `getAccountStatus` method. This is a high-priority fail-closed gap to address with a V2-native design, not by copying the broad legacy migration.
3. PR #32 contains many admin pages, including financial and withdrawal surfaces. UI presence does not authorize financial operations. Every action needs a V2 server-side permission boundary, actor audit, idempotency, and tests.
4. PR #33's `test_config` and app distribution SQL target legacy `public.apps` / `public.tests`. Translate the requirements to `rebuild_v2`; do not apply its SQL to V2 unchanged.
5. PR #30's legacy evidence table and RPC workflow differ from V2's draft/register/finalize contract. Keep the V2 workflow as the intended direction pending schema provenance and runtime tests.

## Recommended next implementation order

1. **Migration provenance:** recover all FixLab V2 runtime SQL definitions and make a reproducible migration sequence.
2. **Security:** complete ban/suspension enforcement, role boundaries, authenticated RLS/RPC smoke tests and Storage access tests.
3. **Admin module:** create V2-native admin route map, permission matrix, audit trail and read-only dashboards before enabling mutations.
4. **Developer creation:** finish the six-step UX by extending V2's existing test model/API intentionally, with draft-only behavior and server validation.
5. **Tester workflow:** verify V2 check-in, report submission and private evidence workflows end-to-end; keep reward posting disabled.
6. **Visual parity:** selectively port developer/tester UI improvements from #19/#22/#23/#31 after behavior and accessibility review.

## Explicitly not done

- No PR merged, closed, retargeted, or force-pushed.
- No branch deleted.
- No Production or FixLab database changed by this audit.
- No migration applied or generated.
- No Vercel setting or deployment changed.
