# TestDZ Branch and Feature Porting Matrix

**Reviewed:** 2026-11-17  
**Candidate baseline:** `rebuild/testdz-v2` — `c446bedfa637e348d5d093ea8310ff270d24b8e5`  
**Purpose:** Identify useful work in open PRs and side branches without merging incompatible histories.

## Current GitHub inventory

- Repository visibility: Public.
- Default branch: `main`.
- Remote branches returned by GitHub: 54.
- Open pull requests returned by GitHub: 29; Draft status varies and must be checked per PR.
- Branch-protection inventory from the previous review is stale; refresh it before any branch deletion or consolidation.
- V2 remains the candidate consolidation baseline, not yet the default branch or a production-ready release.

## Feature porting decisions

| Source PR / branch | Work found | V2 evidence | Decision |
|---|---|---|---|
| #46 `test/v2-security-definer-boundaries` | Adds a final-state SQL contract for SECURITY DEFINER search_path, owner, schema USAGE, and no-CREATE boundaries | Merged into V2 as `e98e13d806d574b30ef163ff059dfbc4dd2e9733`; PR and post-merge Rebuild V2 CI passed | Integrated via squash merge; retain source branch as an audit reference until branch consolidation is reviewed |
| #45 `fix/local-postgrest-v2-schema` | Aligns local PostgREST exposure with the V2 frontend schema selector; adds a local schema bootstrap and HTTP checks for exposed `rebuild_v2` and hidden `rebuild_v2_private` | Merged into V2 as `e8cb30e6494f56af9ecc42be72ba31073d9a49e3`; PR and post-merge Rebuild V2 CI passed | Integrated via squash merge; retain source branch as an audit reference until branch consolidation is reviewed |
| #47 `fix/v2-restrict-private-rpc-exec` | Revokes authenticated EXECUTE from three unwrapped role-management implementations while preserving wallet posting and policy-helper grants | Merged into V2 as `baa6e7e5f168353dc71ede1ad692730dfec4821f`; isolated Rebuild V2 CI run `43982190131` passed | Integrated via squash merge; retain source branch as an audit reference until branch consolidation is reviewed |
| #44 `fix/v2-algeria-business-date` | Fixes Algeria-local calendar dates in tester discovery, join eligibility, assignment scheduling, and daily check-ins; aligns the check-in default and adds midnight-boundary regression checks | Merged into V2; isolated Rebuild V2 CI and legacy migration CI passed | Integrated via squash merge; retain source branch as an audit reference until branch consolidation is reviewed |
| #49 `fix/v2-notification-recipient-roles` | Separates tester/developer notification feeds, recipient-aware read RPCs, RLS, and unread counters; legacy mode omits the V2-only `recipient_role` filter | Head `1d2ff76`; latest TestDZ, frontend, isolated 19-script replay, and Vercel checks passed. The notification pipeline is extended by stacked PRs #52–#54 | Keep Draft until the full stack is integrated and reviewed |
| #48 `audit/v2-catalog-fingerprint` | Adds read-only catalog fingerprint and drill-down contracts to compare V2 candidate with FixLab | Updated head `3a28ffd`; isolated database validation run `44142397776` passed. Fingerprint deliberately excludes known date-function/check-in-date deltas, legacy Storage policies, `app-icons` bucket metadata, and two CHECK constraints with redundant-parenthesis differences | Keep Draft; inspect every excluded difference and legacy Storage policy before claiming full parity or planning cutover |
| #43 `chore/v2-repository-hygiene` | Adds root `.gitignore` rules for generated artifacts and local environments | Its sole `.gitignore` content matched the V2 file; GitHub now reports the PR merged at `c446bed` | No separate feature work remains; do not delete the source branch until dependent references are checked |
| #42 `chore/v2-agent-governance` | Repository-wide agent rules, engineering roles, consolidation plan, catalog parity, migration provenance, and Production legacy Storage review | This branch remains separate from the notification stack. Its database workflow still expects 18 scripts; the current stacked candidate in PR #53 contains 21 scripts. The 18-script guard is correct only for this branch's current base and must be reconciled with the 21-script workflow/contracts when the branch is integrated. CI review confirms general CI excludes V2 while dedicated frontend and database workflows cover V2 | Keep Draft; reconcile workflow and documentation against the final integration base before merge |
| #41 `chore/termux-local-preflight` | Adds a static Termux-friendly local preflight script; does not start Docker, call Supabase, or execute SQL | One standalone script only, but its source branch is based on an old Week 5 chain and compare includes a large legacy tree | Candidate for isolated port after validating assumptions against current V2 migration/test layout; do not merge the branch history |
| #40 `fix/restrict-test-lifecycle-column-writes` | Restricts direct client writes to test lifecycle/ownership columns in legacy `public.tests` | V2 uses server-side `create_test`/`update_test` private implementations and exposes wrappers; exact table grants still need final privilege-contract confirmation | Do not port the legacy migration directly; verify V2 effective grants and add a contract only if a gap is proven |
| #39 `fix/android-package-name-validation` | Fixes Android package ID regex in legacy `private.create_app_impl` | V2 `003_app_lifecycle.sql` already validates package IDs with literal-dot separators using `([.])` and rejects malformed values | Already represented in V2; preserve as historical evidence, no port needed |
| #38 `fix/test-app-developer-ownership-rls` | Enforces test-to-app developer ownership through legacy `public.tests` RLS | V2 `001_schema.sql` has composite FK `(app_id, developer_id)` to apps; `008_developer_lifecycle.sql` verifies the app belongs to the caller before test creation | V2-native equivalent exists; do not port the legacy RLS migration |
| #37 `fix/test-details-only-rebuild-compatible` | Adds structured test details, steps, requirements, media, and table grants to legacy `public` schema | V2 already has `tests` metadata, `test_steps`, `test_requirements`, `test_media`, atomic content authoring in 011, and private media controls in 015 | Capability is substantially represented; compare remaining field semantics only, do not port legacy tables/migrations |
| #36 `fix/week-5-fk-reconciliation` | Reconciles legacy `assignments.cohort_id` foreign keys and test migration harness | V2 has a new cohort/test relationship with composite constraints and candidate contracts; old Week 5 FK migration targets legacy schema | Keep separate as legacy migration-history evidence; no direct port without a public-schema compatibility decision |
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

## Candidate-script count and integration sequencing clarification (2026-11-18)

The notification stack now reaches 21 ordered candidate scripts (`001`–`021`) on PR #53, with PR #49 adding `019`, PR #53 adding `020` and `021`, and the stack CI expecting exactly 21. PR #42 remains on a separate base and its workflow still expects 18; that is locally consistent with its current branch but becomes stale if ported unchanged onto the notification stack. PR #48's catalog fingerprint was authored against the 18-script candidate and must be replayed/re-baselined against the final 21-script candidate before it can support any parity claim. Keep all these branches Draft until their workflow, contract lists, and evidence are reconciled.

## Notification pipeline status (read-only review, 2026-11-18)

The notification work is now represented by a four-PR Draft stack (#49 → #52 → #53 → #54). PR #49 provides role-separated feeds and read-state RPCs; PR #52 locks direct client writes to the outbox tables; PR #53 adds trusted assignment/feedback event producers and a service-role-only batch dispatcher; PR #54 adds the protected developer notifications page with EN/FR/AR support.

The current PR #53 head passed an exact 21-script isolated Supabase replay and SQL/PostgREST contracts (run `44267957934`). PR #54's exact head passed Frontend CI, TestDZ CI, and Vercel Preview. No hosted database was changed, no Edge Function was deployed, and no cron job or dispatch secret was configured.

Remaining gates: Deno type-check the Edge Function source in CI; review worker timeout/retry/observability behavior and shared-secret rotation; manually inspect the developer page at mobile/desktop sizes and RTL; then rerun the full stack checks after integration. Do not treat a successful SQL replay as proof that the Edge Function runtime is deployable. Keep all four PRs Draft until these gates and broader architecture review are complete.

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

- PR #44, PR #45, PR #46, and PR #47 were squash-merged into `rebuild/testdz-v2` after their isolated Rebuild V2 CI checks passed. PR #42, #43, and #48 remain Draft. PR #18 remains open and dirty; do not merge or delete it. No other PR was merged, closed, or retargeted; no branch was force-pushed.
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

### Read-only recovery checkpoint: seven missing V2 implementation bodies (2026-11-17)

A fresh read-only FixLab catalog query successfully extracted the seven `rebuild_v2_private` implementation definitions corresponding to the frontend RPCs listed above, alongside their seven exposed `rebuild_v2` wrappers. This confirms the runtime definitions can be recovered from the current FixLab catalog; it does not make them part of committed migration history, and no SQL was applied or written back to the database.

The recovered implementation set is:
- `create_test_impl` and `update_test_impl`: developer/admin role checks, input validation, ownership/status checks, and audit events.
- `save_test_content_impl`: validates structured steps/requirements and atomically replaces child rows for owned editable tests.
- `submit_checkin_impl`: tester ownership/active-assignment checks and duplicate handling.
- `create_assignment_submission_impl`, `register_assignment_submission_attachment_impl`, and `finalize_assignment_submission_impl`: draft submission, attachment metadata registration, Storage metadata verification, and finalization.

**Important live-state confirmation:** the currently hosted FixLab `submit_checkin_impl` still uses `CURRENT_DATE` in its lookup, insert, and unique-violation recovery paths. The Algeria-local correction recorded for the V2 candidate has not been applied to FixLab. This remains a confirmed hosted FixLab timezone defect; do not infer that merging a candidate branch patches the hosted project.

Before these recovered bodies can become reproducible migrations, still capture and review the complete object dependencies and privileges: wrapper and implementation owners, SECURITY DEFINER/INVOKER attributes, function ACLs, referenced helper definitions, table grants/RLS policies, triggers/indexes/constraints, and Storage policy assumptions. Then produce a reviewed clean-replay migration sequence and run the isolated contract suite. No hosted migration history, schema, or data was changed during this checkpoint.


### Candidate SQL recovery and hosted parity cross-check (read-only, 2026-11-17)

A complete filename-by-filename scan of the 18 SQL files under `supabase/rebuild-v2/` on the current V2 base found that **all seven recovered implementation bodies already exist in the candidate SQL sequence**. This corrects a possible ambiguity in the earlier migration-provenance wording: the seven routines are absent from the 31 committed files in `supabase/migrations/`, but they are not absent from the separate candidate rebuild sequence.

| Runtime implementation | Candidate source | Candidate sequence evidence |
|---|---|---|
| `create_test_impl` | `008_developer_lifecycle.sql` | Definition, exposed wrapper, role checks, and execute grants |
| `update_test_impl` | `008_developer_lifecycle.sql` | Definition, exposed wrapper, role checks, and execute grants |
| `save_test_content_impl` | `011_test_content_authoring.sql` | Definition, exposed wrapper, and execute grants |
| `submit_checkin_impl` | `007_tester_workflow.sql` | Definition and wrapper; uses the candidate Algeria-local date helper |
| `create_assignment_submission_impl` | `007_tester_workflow.sql` | Definition and wrapper; private implementation EXECUTE revoked from authenticated |
| `register_assignment_submission_attachment_impl` | `007_tester_workflow.sql` | Definition and wrapper; private implementation EXECUTE revoked from authenticated |
| `finalize_assignment_submission_impl` | `007_tester_workflow.sql`, subsequently hardened in `018_verify_submission_evidence_metadata.sql` | Final candidate version verifies Storage object owner, size, and MIME metadata before finalization |

The candidate check-in implementation in `007_tester_workflow.sql` computes one `v_checkin_date := rebuild_v2_private.algeria_local_date()` and uses it consistently for lookup, insert, and unique-violation recovery. The live FixLab implementation inspected on 2026-11-17 still uses `CURRENT_DATE` in all three locations, and the corresponding `rebuild_v2_private.algeria_local_date()` helper was not found in the hosted catalog. This is a concrete **candidate-vs-hosted parity drift**, not evidence that the candidate fix is already deployed.

The live wrapper/implementation privilege shape also differs by workflow, as expected from the candidate design:
- `create_test`, `update_test`, and `save_test_content` are SECURITY INVOKER wrappers; their private implementations currently grant EXECUTE to `authenticated` so the invoker can call them. Their bodies independently validate `auth.uid()`, role, ownership, and editable status.
- The four tester workflow wrappers are SECURITY DEFINER; their private implementation ACLs currently grant EXECUTE only to `postgres`, while the exposed wrappers grant EXECUTE to `authenticated`.
- The `has_role` helper is SECURITY DEFINER and checks that its supplied user ID equals `auth.uid()` before reading role rows.
- Authenticated has schema USAGE on both `rebuild_v2` and `rebuild_v2_private`; anon does not have private-schema USAGE. The SQL session did not expose the PostgREST schema allowlist setting, so actual hosted API exposure of the private schema was not inferred from SQL alone.

The live catalog review also confirmed the relevant workflow tables have both RLS and FORCE RLS enabled, authenticated SELECT only, and no direct authenticated INSERT/UPDATE/DELETE privileges. The `test-evidence` bucket is private with a 10 MiB object limit. Storage policies use dedicated upload/read helper functions. These facts support the intended server-mediated workflow but do not replace replay tests.

**Next gate:** build a per-object parity ledger comparing each candidate definition with the hosted wrapper and implementation (definition hash + reviewed semantic diff), then capture helper dependencies, grants, policies, indexes, constraints, and Storage metadata assumptions. Do not generate or apply migrations until this ledger and clean isolated replay tests are complete. No hosted SQL, data, or migration history was changed during this review.


### FixLab advisor snapshot and effective access check (read-only, 2026-11-17)

Supabase advisors were refreshed after the function/catalog inspection:
- **Security:** one INFO lint, `rls_enabled_no_policy`, count 4: legacy `public.audit_logs`, `public.fraud_reviews`, `public.platform_config`, and `public.user_roles`.
- A direct privilege check confirmed all four tables have RLS enabled and grant neither SELECT nor INSERT/UPDATE/DELETE to `anon` or `authenticated`. Their no-policy state is therefore default-deny for those API roles in the inspected catalog; this is not evidence of an anonymous data leak. Keep the tables restricted and decide whether trusted backend access needs an explicit, narrowly scoped path.
- **Performance:** `unindexed_foreign_keys` count 33 and `unused_index` count 20 across the project. The unindexed-FK findings include V2 submission/attachment identity foreign keys and several legacy `public` relations. The unused-index findings include V2 indexes such as `assignment_submissions_tester_created_idx`, `assignment_submission_attachments_assignment_idx`, and `events_dispatch_v2`.
- Do not bulk-create indexes from the advisor output or delete indexes labeled unused. Review actual query plans, workload, and FK update/delete patterns first; the unused-index sample may reflect a lightly exercised FixLab database.

This is an advisor snapshot, not a migration or remediation. No grants, policies, indexes, or table data were changed.
