# TestDZ Branch and Feature Porting Matrix

**Reviewed:** 2026-11-16  
**Candidate baseline:** `rebuild/testdz-v2` — `6a60e6f04ba05d6af6ee962a306e795c39fa2eb7`  
**Purpose:** Identify useful work in open PRs and side branches without merging incompatible histories.

## Current GitHub inventory

- Repository visibility: Public.
- Default branch: `main`.
- Remote branches returned by GitHub: 49.
- Open pull requests returned by GitHub: 28; all are Draft.
- Branch protection: none of the 47 listed branches is protected.
- V2 remains the candidate consolidation baseline, not yet the default branch or a production-ready release.

## Feature porting decisions

| Source PR / branch | Work found | V2 evidence | Decision |
|---|---|---|---|
| #44 `fix/v2-algeria-business-date` | Fixes Algeria-local calendar dates in tester discovery, join eligibility, assignment scheduling, and daily check-ins; aligns the check-in default and adds midnight-boundary regression checks | Merged into V2 as `6a60e6f04ba05d6af6ee962a306e795c39fa2eb7`; isolated Rebuild V2 CI and legacy migration CI passed | Integrated via squash merge; retain source branch as an audit reference until branch consolidation is reviewed |
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

- PR #44 was squash-merged into `rebuild/testdz-v2` after isolated database CI passed. No other PR was merged, closed, or retargeted; no branch was force-pushed.
- No branch deleted.
- No Production or FixLab database changed by this audit.
- No migration applied or generated.
- No Vercel setting or deployment changed.


## Fresh FixLab runtime verification (read-only, 2026-11-16)

The connected project `TestDZ-FixLab` (`bxjqwqidmxxnsgnpyzxv`) is `ACTIVE_HEALTHY`. Its current migration history contains 21 applied entries, latest `20261116162951 verify_submission_evidence_metadata`. This is later than the committed V2 migration set, which ends on 2026-11-12.

The FixLab database currently contains the following V2 API wrappers in `rebuild_v2`, with corresponding implementation routines in `rebuild_v2_private`:
- `create_test`, `update_test`, `save_test_content`
- `submit_checkin`
- `create_assignment_submission`, `register_assignment_submission_attachment`, `finalize_assignment_submission`

The wrappers were observed with `authenticated` EXECUTE and `anon` EXECUTE false. Several wrappers are SECURITY DEFINER and delegate to private implementation routines. This is evidence of current FixLab runtime state only; it does not supply a reproducible committed migration history. Recover and review the complete wrapper and implementation SQL, grants, constraints, policies, triggers, and Storage policies before reconstructing the canonical migration set.

### Confirmed V2 check-in timezone defect

- FixLab database setting `TimeZone` is `UTC`.
- The current `rebuild_v2_private.submit_checkin_impl` derives the check-in date with `CURRENT_DATE`.
- Algeria local time is UTC+1; therefore between 00:00 and 00:59 Africa/Algiers, `CURRENT_DATE` still represents the previous Algeria calendar day.
- The V2 frontend displays local dates, so a check-in made during that hour can be recorded against the prior date or return the prior day's existing check-in ID.

**Classification:** Confirmed timezone-boundary defect in the FixLab V2 candidate, not a speculative risk.

**Required correction:** Derive the business date explicitly from `(now() AT TIME ZONE 'Africa/Algiers')::date` (or a single documented Algeria business-time helper), and add a regression test covering UTC 23:xx / Algeria 00:xx plus duplicate-submission behavior. Do not copy PR #29's legacy points/wallet award logic when correcting the date. No change has been applied.



### FixLab applied migration inventory (version/name only)

The read-only migration-history query returned these 21 entries. The history records versions and names; it does not expose the original SQL bodies through the migration-list operation.

| Version | Recorded name |
|---|---|
| `20261115095605` | `fixlab_initial_core_schema_fixture` |
| `20261115095608` | `test_details_only_schema_candidate` |
| `20261115095618` | `enable_pgtap_for_fixlab` |
| `20261115101419` | `fixlab_split_test_detail_owner_policies` |
| `20261115101706` | `fixlab_enforce_test_app_developer_ownership` |
| `20261115102554` | `restrict_test_detail_table_grants` |
| `20261115102751` | `fix_android_package_name_validation` |
| `20261115102836` | `restrict_test_lifecycle_column_writes` |
| `20261115160318` | `rebuild_v2_sandbox_namespace` |
| `20261115193304` | `fixlab_v2_developer_lifecycle_candidate` |
| `20261115193600` | `fixlab_lock_app_edits_during_review` |
| `20261115193720` | `fixlab_guard_test_cohort_capacity` |
| `20261116145646` | `fixlab_v2_test_content_authoring` |
| `20261116145833` | `fixlab_v2_test_content_authoring_validation` |
| `20261116150813` | `fixlab_v2_cohort_management` |
| `20261116151440` | `fixlab_v2_private_test_builds` |
| `20261116151830` | `fixlab_v2_harden_test_build_storage_helper` |
| `20261116153736` | `fixlab_v2_private_test_media_assets` |
| `20261116154657` | `fixlab_v2_private_developer_feedback` |
| `20261116162502` | `enforce_assignment_schedule` |
| `20261116162951` | `verify_submission_evidence_metadata` |

Do not infer that a migration is reproducible from its name. Each version still needs its original SQL or an independently reviewed catalog reconstruction, plus object-level mapping and clean replay evidence.


## Agent skill files and local cleanup

The V2 Git tree contains `.skill-lab/global/` with the shared agent skills (including code-security, code-review, semgrep, find-bugs, security-review, gha-security-review, UI/UX Pro Max, UI styling, design system, banner, brand, design, slides, and free-LLM-APIs). These global skills are already versioned in the V2 baseline.

The last local Termux inventory also found:
- `.agents/skills/` with seven agent skill directories — this directory is not present in the V2 Git tree.
- `.skill-lab/project/` with project-specific brand/design/design-system material — this directory is not present in the V2 Git tree.
- Local Python cache directories and `test-results.txt` — generated artifacts, not reusable skill source.
- `frontend/` contained only `package-lock.json` and `.env.local` at the inspected depth; it had no `package.json` or source files. Never upload or display `.env.local`.

If the user deletes local worktrees, the already-committed `.skill-lab/global/` remains recoverable from V2. The untracked `.agents/` and `.skill-lab/project/` content would not be recoverable from GitHub unless separately archived or committed. Do not mix these agent-only directories into application source or upload them without a deliberate decision.


### Exact FixLab check-in function evidence

A read-only `pg_get_functiondef` inspection confirmed the current implementation:

- Public-facing wrapper: `rebuild_v2.submit_checkin(p_assignment_id uuid, p_note text DEFAULT NULL)`.
- Wrapper is `SECURITY DEFINER`, has an empty `search_path`, sets `row_security = off`, and delegates to `rebuild_v2_private.submit_checkin_impl`.
- Private implementation is also `SECURITY DEFINER`, with empty `search_path` and `row_security = off`.
- The implementation explicitly checks `auth.uid()`, validates note length, locks the assignment row `FOR UPDATE`, verifies tester ownership and active status, and handles a duplicate unique violation idempotently.
- The date defect is specifically caused by using `CURRENT_DATE` in the existing-checkin lookup, insert, and unique-violation recovery lookup. The function does not derive the business date in `Africa/Algiers`.

**Safe correction design (not applied):** compute one `v_checkin_date := (now() AT TIME ZONE 'Africa/Algiers')::date` after authentication and use that same variable for all three date operations. Add pgTAP cases that set the transaction time to UTC 23:xx and prove the resulting business date is the next Algeria calendar day, plus same-day duplicate and concurrent-submission coverage. Do not change reward/points balances or create any wallet entries.

The exposed wrapper currently has `authenticated` EXECUTE and `anon` EXECUTE is false. The private implementation itself has no direct `authenticated` EXECUTE in the inspected privilege result. Keep that boundary when reconstructing the canonical migration.

### Runtime function inventory clarification

The earlier seven-function gap refers to **missing committed migration definitions**, not absent FixLab runtime objects. The runtime catalog confirmed these exact exposed wrappers and signatures:

| Wrapper | Arguments | Return | SECURITY DEFINER |
|---|---|---|---|
| `create_test` | `p_app_id uuid, p_title text, p_description text, p_short_summary text, p_test_type text, p_min_testers integer, p_start_date date, p_end_date date, p_duration integer, p_instructions text` | `uuid` | No |
| `update_test` | `p_test_id uuid` plus the same test fields | `void` | No |
| `save_test_content` | `p_test_id uuid, p_steps jsonb, p_requirements jsonb` | `void` | No |
| `submit_checkin` | `p_assignment_id uuid, p_note text` | `uuid` | Yes |
| `create_assignment_submission` | `p_assignment_id uuid, p_summary text, p_comments text` | `uuid` | Yes |
| `register_assignment_submission_attachment` | `p_submission_id uuid, p_file_id uuid, p_extension text, p_original_filename text, p_mime_type text, p_size_bytes bigint` | `text` | Yes |
| `finalize_assignment_submission` | `p_submission_id uuid` | `boolean` | Yes |

Each exposed wrapper had `authenticated` EXECUTE and `anon` EXECUTE false in the FixLab catalog snapshot. The submission wrappers delegate to private implementation functions. This catalog inventory is not a replacement for extracting the full function bodies, grants, dependent tables, triggers, indexes, RLS policies, and Storage policies into reviewed migration files.

A read-only boundary calculation was verified against FixLab: UTC `2026-11-15 23:30` converts to Algeria local hour `00` and business date `2026-11-16`, while its UTC date remains `2026-11-15`. This confirms the proposed date expression crosses the intended calendar boundary in the live database runtime.
