# TestDZ Repository Consolidation Plan

**Snapshot date:** 2026-11-16  
**Repository:** `laidktif67-sketch/TestDZ`  
**Working baseline:** `rebuild/testdz-v2` at `54c36b5a9d9fcaae5bdc118921b7b5eb142ba9bc`  
**Status:** Active consolidation; no branch, PR, migration, or database cleanup has been performed.

## 1. Canonical working direction

- Use `rebuild/testdz-v2` as the candidate application baseline for ongoing consolidation and verification.
- Do not treat GitHub's current default branch `main` as V2; it currently points to a different history.
- Keep `main`, `architecture-v1`, and PR #18 unchanged until an explicit cutover and merge plan is approved.
- PR #18 (`integrate/pr17-into-architecture`) remains open and Draft. Its head commit `24bcaa1c01db69db1c15b55bca992ea9f3feaff0` is an ancestor of V2; V2 contains its history. This is not permission to merge, close, retarget, or delete PR #18.
- Avoid creating many parallel branches. Use one focused branch/PR per coherent consolidation unit.

## 2. Repository inventory

The current GitHub snapshot reports:
- 47 remote branches.
- 27 open pull requests; all 27 are Draft.
- Multiple PRs form dependent chains, especially tester, developer, medical-exception, support-ticket, and Week 5 database work.
- No branch in the fetched branch list is protected.
- The repository is currently **Public**, although the V2 README says **Private**. Repository visibility is an owner-level decision and has not been changed.

Do not bulk-merge or bulk-delete branches/PRs. Build a dependency map first, compare each branch with the V2 baseline, and classify its unique work as: already included, useful and not included, obsolete, conflicting, or unsafe/unverified.

## 3. Database and migration blockers

- V2 currently tracks 31 files under `supabase/migrations/`, ending at `20261112000100_support_ticket_conversations.sql`.
- The FixLab project has a separate hosted migration history of 21 entries. The recorded versions do not match the 31 checked-in migration filenames.
- The V2 candidate schema in FixLab has been inspected separately from Production. The candidate includes `rebuild_v2` and private internal routines in `rebuild_v2_private`; do not expose the private schema through PostgREST.
- Existing V2 documentation records 47 candidate tables, RLS and FORCE RLS coverage, and 18 candidate SQL scripts used in a disposable local replay. Those scripts are not currently represented as a reproducible committed migration sequence in this branch.
- The 21 FixLab migration-history records are not a one-to-one substitute for the 31 legacy repository migrations. Their SQL bodies have not been proven archived.
- Therefore, no migration history rewrite, remote reset, schema pull, or database reset is authorized by this plan.

### Required migration recovery sequence

1. Preserve the exact FixLab migration-history inventory (version and name).
2. Recover or independently reconstruct the SQL bodies for every candidate schema change.
3. Map every candidate SQL change to its intended schema object and migration-history record.
4. Decide whether legacy `public` remains supported during transition or is retired only after full frontend cutover.
5. Build one canonical, chronological migration sequence from a clean isolated environment.
6. Replay the sequence in disposable local CI and compare tables, columns, constraints, indexes, functions, grants, RLS policies, triggers, Storage buckets, and object policies.
7. Complete authenticated PostgREST/RLS/RPC smoke tests and rollback rehearsal.
8. Only then propose a separately approved FixLab reconciliation. Production remains out of scope.

## 4. Environment safety

- `supabase/config.toml` currently names the Production project ref `naqjjykcglxiobkmdllj`. Do not run linked/remote Supabase CLI commands using this config.
- FixLab ref is `bxjqwqidmxxnsgnpyzxv`; use it only for explicitly approved isolated validation.
- Do not change Production schema, migration history, Auth users, Storage objects, or application data.
- Do not change Vercel settings, environment variables, or deploy as part of repository organization.
- Do not commit environment files, API keys, service-role keys, tokens, or local secrets.

## 5. Branch and PR consolidation rules

For each open PR and branch:
1. Record its base, head SHA, changed paths, unique commits, and downstream dependents.
2. Compare its file-level changes with V2, not only its commit count.
3. Inspect database migrations and tests independently from UI changes.
4. Port only verified missing functionality into the V2 architecture.
5. Run the relevant CI workflows and inspect the resulting checks.
6. Keep the source branch and PR until the port is verified and the owner approves closure/deletion.

PR #18 is a protected historical reference for this consolidation: do not merge, close, retarget, or delete it automatically.

## 6. Frontend and architecture direction

- Preserve the implemented React + TypeScript + Vite web application in `apps/web/`.
- Keep the modular-monolith domain boundaries and feature APIs; do not restore oversized catch-all API modules.
- Keep Auth and Storage on the base Supabase client; route application table/RPC operations through the central application data client.
- Keep `rebuild_v2_private` internal and unexposed.
- Retain the V2 feature flag until every route/API contract, authorization path, compatibility path, and rollback gate is verified. Do not enable it in Production as part of cleanup.
- Keep wallet reward posting, withdrawals, payments, and other gated financial operations disabled until their server-authoritative workflows and tests are approved.

## 7. Local-only work that must be preserved before device cleanup

The last local inventory identified:
- `fix/secure-test-creation-ownership` at `94a27dfa`, with no upstream branch at the time of inspection.
- `skills-lab` had local commits not present on its upstream at the time of inspection.
- Untracked local `.agents/`, `.skill-lab/`, `frontend/`, and `node_modules/` content existed.

Do not delete local repositories/worktrees until all local-only Git commits are bundled or pushed to a remote backup and any needed untracked files are separately archived. In particular, a local-only commit cannot be recovered from GitHub merely because its parent branch exists remotely.

## 8. Immediate work sequence

1. Establish repository governance on V2 (this PR).
2. Produce a branch/PR dependency inventory and a keep/port/retire recommendation without deleting anything.
3. Reconcile the unique Week 5 ownership and FK fixes against V2 schema and tests.
4. Recover the candidate V2 SQL source and establish reproducible migration provenance.
5. Complete route/API/schema compatibility and authenticated security smoke tests.
6. Prepare a final V2 cutover proposal, including backup/restore and rollback evidence.
7. Ask for explicit approval before changing the default branch, merging, deleting branches/PRs, altering repository visibility, or touching Production.

## 9. Current verification limits

This plan is based on GitHub metadata, committed files, and previously recorded FixLab inspection results. It does not claim a fresh live database comparison, authenticated runtime smoke test, complete branch-by-branch code review, or Production validation. Those checks remain explicit gates.


## 10. Branch comparison evidence (2026-11-16)

The following GitHub compare results are history comparisons against `rebuild/testdz-v2`; ahead/behind counts are commit ancestry counts, **not counts of missing features**:

| Branch | Ahead of V2 | Behind V2 | Changed paths reported |
|---|---:|---:|---:|
| `integrate/pr17-into-architecture` (PR #18 head) | 0 | 494 | 0 |
| `feature/developer-full-lifecycle` | 896 | 494 | 235 |
| `feat/developer-create-test-six-step` | 941 | 494 | 242 |
| `fix/supabase-rebuild-fk-indexes` | 942 | 494 | 243 |
| `feature/developer-my-tests-dashboard` | 279 | 494 | 69 |
| `fix/security-c1-test-ownership` | 106 | 1,376 | 73 |
| `fix/restrict-test-lifecycle-column-writes` | 108 | 1,376 | 74 |
| `fix/test-app-developer-ownership-rls` | 101 | 1,376 | 70 |
| `fix/test-details-only-rebuild-compatible` | 106 | 1,376 | 72 |
| `fix/week-5-fk-reconciliation` | 105 | 1,376 | 70 |
| `fix/unify-tester-sidebar` | 52 | 494 | 27 |
| `chore/engineering-governance` | 21 | 494 | 15 |

The Week 5 ownership/FK branch family is based on a substantially different history from V2. Its recent migrations target the legacy `public.apps` and `public.tests` objects, while the candidate V2 application schema is `rebuild_v2`. Do not copy or apply those migrations verbatim to the V2 candidate schema. Port the invariant and tests only after translating them to the actual V2 schema and checking existing constraints and RPC ownership.

The local-only commit `94a27dfa` on `fix/secure-test-creation-ownership` was subsequently pushed successfully. GitHub now confirms remote branch HEAD `94a27dfac444f317f6f2d09fce5db59b62aad2e0`. The commit contains a follow-up migration, client draft-creation change, and pgTAP coverage. The branch remains unprotected and has no PR. Its history is heavily divergent from V2 (942 commits ahead / 494 behind), and the candidate patch changes the legacy `public.tests` schema. Do not open a PR directly against V2 or merge this branch wholesale: first port the narrow ownership/default-draft invariant and its regression tests into the actual V2 schema, after inspecting V2 equivalents. The older local worktree inventory also recorded untracked `skills-lab` changes; re-check its current local-vs-remote state before deleting the worktree.


## 11. Feature porting matrix

The detailed PR/branch decisions, V2 feature evidence, migration provenance blocker, security cautions, and implementation order are maintained in [`BRANCH_PORTING_MATRIX.md`](./BRANCH_PORTING_MATRIX.md). The matrix was added after inspecting the current 47-branch / 27-open-PR GitHub inventory and scanning all 31 committed V2 migration files.


## 12. CI and migration-workflow audit (2026-11-16)

### Duplicate frontend CI

The V2 branch currently has two workflows that both install dependencies, run TypeScript typecheck, and build the web workspace on the same V2 push / pull-request path filters:

- `.github/workflows/ci.yml` (TestDZ CI): uses `npm install`, runs typecheck/build, and does not run the tester data-boundary check.
- `.github/workflows/frontend-ci.yml` (Frontend typecheck and build): uses `npm ci`, runs `npm run check:data-boundary`, typecheck, and build; it also has concurrency cancellation and a timeout.

Both workflows were observed running for the same V2 commits. On commit `c5b12ee3f699b1361db0436e64ee2744a82dafb6`, run `43963908283` (TestDZ CI) and run `43963908250` (Frontend typecheck and build) both completed successfully. This confirms duplicate execution, not a failing build. Implemented on this governance branch: `ci.yml` now runs only for pushes and PRs targeting `main` or `architecture-v1`; `frontend-ci.yml` now runs only for pushes and PRs targeting `rebuild/testdz-v2`. This preserves legacy-branch checks while making the V2 workflow the sole frontend CI path for V2 PRs. The V2 workflow retains `npm ci`, the data-boundary check, typecheck, build, timeout, and concurrency cancellation. The older workflow remains in the repository for the legacy branches.

### Manual migration workflow target mismatch — HIGH RISK

The file `.github/workflows/apply-migration.yml` describes its target as a development project/environment, but its precondition explicitly requires `SUPABASE_PROJECT_REF=naqjjykcglxiobkmdllj`, which is the recorded Production project ref. The job then links Supabase CLI to that ref and runs `supabase db push --remote --yes`. Its branch guard limits execution to `feat/week-4-design-system`, but does not make the target a development project. This is a dangerous naming/configuration mismatch and must be treated as a Production-capable workflow.

Do not dispatch this workflow. Do not change its secrets, environment, branch guard, or target in this documentation-only task. Before any future use, an owner-approved separate change must either remove/quarantine the workflow or establish a verified non-production project ref, dedicated credentials/environment, explicit migration allowlist, and a dry-run/read-back gate. The current V2 consolidation must not use this workflow.

### Validation limits

The workflow files were read from `rebuild/testdz-v2`; recent Actions metadata was inspected read-only. The two workflow trigger files were edited on this governance branch and read back to verify their branch filters. No workflow was manually dispatched or rerun. No migration was applied and no Supabase project was changed.


### CI action and CLI reproducibility hardening

- The V2 frontend workflow now pins `actions/setup-node` to the verified v4.4.0 commit SHA `49933ea5288caeca8642d1e84afbd3f7d6820020` rather than the moving `@v4` tag.
- The isolated Rebuild V2 database-test workflow now pins `supabase/setup-cli` to the verified v3.2.0 action commit `689adcfb80d947100a1eab127289b97d1fb07b13` and the Supabase CLI itself to stable `3.1.0`, rather than resolving `latest` on each run.
- This is a local disposable-stack test workflow only. Its commands remain `supabase start`, local `psql` against the local stack URL, and `supabase stop`; no hosted target or credentials were added.
- The pin was chosen after reviewing the Supabase CLI v3 migration guidance: v3 changes local/remote command defaults and unattended hosted-change confirmation. Pinning avoids a future unreviewed CLI upgrade changing CI behavior. See the [Supabase CLI v3 migration guide](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3) and [Supabase changelog](https://supabase.com/changelog).

These changes are on the governance PR branch. They require the newly triggered V2 isolated database-test workflow to complete before being considered verified.


## 13. Workspace and frontend build inventory (2026-11-16)

### Confirmed npm workspace topology

The V2 root manifest declares npm workspaces `apps/web` and `packages/*`. The committed lockfile is lockfileVersion 3 and records exactly these current workspace packages:

| Workspace | Package name | Current role |
|---|---|---|
| `apps/web` | `testdz-frontend` | React 18 + TypeScript + Vite application |
| `packages/types` | `@testdz/types` | Shared TypeScript type exports |

The lockfile records both workspace links (`node_modules/testdz-frontend` → `apps/web`; `node_modules/@testdz/types` → `packages/types`). No other `packages/*` workspace is recorded in the lockfile snapshot inspected.

### Package boundary observations

- The root package is private and owns workspace orchestration scripts: `dev`, `build`, `typecheck`, and `check:data-boundary`.
- The frontend workspace owns Vite development/preview, TypeScript project typecheck, and production build scripts.
- The shared types package exports TypeScript source directly from `src/index.ts`; it currently has no separate build script or generated distribution directory.
- The frontend TypeScript configuration uses project references for its app and Vite config, strict checking, and `noEmit`. The shared types package is consumed through the npm workspace link and package exports.
- The current lockfile and manifests are internally aligned for the two observed workspaces. Do not add a second package manager, generated package build pipeline, or duplicate scripts without a demonstrated consumer need.

### Verified CI result for governance commit

GitHub Actions run [43972628539](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43972628539), on governance commit `b176965bae8d0219eeb95e8c27627370b0de1b12`, completed with conclusion `success`. Its single `frontend` job reports success for all of: checkout, Node setup, locked dependency installation, tester data-boundary check, TypeScript typecheck, and production build. This is evidence for that exact commit and workflow run only; it does not validate database migrations, authenticated runtime behavior, or Production.

### Consolidation decision

No package manifest, lockfile, source module, or workspace boundary was changed during this inventory. The two-workspace topology is coherent enough to retain. Future modularization should add a workspace only when a genuine reusable boundary exists (for example, a separately tested UI component library or a server-side package); do not split feature folders merely to increase package count.

## 14. Fresh FixLab migration-provenance recheck (2026-11-16)

A fresh read-only check was performed against the isolated `TestDZ-FixLab` project (`bxjqwqidmxxnsgnpyzxv`), not Production:

- Project status: `ACTIVE_HEALTHY`; PostgreSQL `17.11.0.019`.
- Hosted migration history still contains 21 entries, spanning `20261115095605` through `20261116162951`.
- The V2 repository branch still contains 31 committed migration files, with the previously recorded last file `20261112000100_support_ticket_conversations.sql`.
- Seven exact candidate migration paths corresponding to later FixLab versions were checked directly on `rebuild/testdz-v2` (including the V2 namespace, developer lifecycle, content authoring, cohort management, private test-build, private feedback, and final evidence-metadata migrations). All seven returned GitHub 404 / not found on that branch.
- Clarification from a subsequent full-tree inspection: those seven timestamped paths are absent specifically from `supabase/migrations/`. The V2 branch separately contains 18 ordered candidate SQL scripts under `supabase/rebuild-v2/`, including the namespace, developer lifecycle, content authoring, cohort management, private build/media/feedback, assignment-schedule, and evidence-metadata work. These candidate scripts provide a clean-replay source, but they are not a one-to-one filename mirror of FixLab's 21 hosted migration-history rows.
- The FixLab table inventory returned 47 tables in `rebuild_v2`, alongside legacy `public` tables. RLS was reported enabled on all returned tables. The private schema has no tables in this inventory; it contains internal routines, not application tables.

The exact hosted migration-history mapping remains unresolved, but the candidate SQL source is not wholly absent: `supabase/rebuild-v2/001_schema.sql` through `018_verify_submission_evidence_metadata.sql` form a separately tested rebuild sequence. The remaining blocker is proving exact live-to-clean catalog equivalence and documenting how the 21 FixLab history rows relate to the 18 candidate scripts; the two sequences must not be treated as interchangeable or one-to-one. Do not create placeholder migrations, mark versions as applied in Git, run `db reset`, run `db push`, or change either hosted project merely to make the histories appear aligned.

### Safe recovery work still required

1. Export each FixLab migration body and all relevant dependent function definitions, grants, triggers, policies, and storage configuration using read-only inspection.
2. Preserve the exports as source evidence before attempting to create canonical migration files.
3. Reconcile each SQL body against the 31 committed V2 migration files and the 47-table candidate schema.
4. Build and replay the canonical sequence in a disposable local database; compare the resulting schema and privileges before proposing any hosted reconciliation.

The Supabase CLI v3 changelog was rechecked before this work. CLI v3 defaults database commands to the local stack and requires explicit `--remote` for hosted operations; unattended hosted changes require `--yes`. The existing repository guardrail against linked/remote CLI use remains in force. No SQL was executed, no migration was applied, and no database state was changed during this recheck.

## 15. FixLab function-source and privilege recheck (read-only, 2026-11-16)

A read-only catalog inspection recovered live function definitions from FixLab and checked effective privileges. No function, grant, schema, or data was changed.

### Function and policy inventory

- `rebuild_v2`: 39 functions.
- `rebuild_v2_private`: 57 functions.
- `rebuild_v2`: 48 RLS policies.
- `storage`: 18 policies.
- Non-internal triggers: 1 in `auth`, 6 in `rebuild_v2`, and 11 in `storage`.
- Of the 57 private functions, 56 are `SECURITY DEFINER`.
- Effective privilege check for role `authenticated`: schema `USAGE` on `rebuild_v2_private` is true; 46/57 private functions are executable; 11/57 are not.
- Effective privilege check for `anon`: zero of the 57 private functions are executable.

### Security interpretation — dependency-backed grants with four explicit grants to review

The private schema is absent from the FixLab PostgREST exposed-schema list. The 46 authenticated EXECUTE grants are not all unexplained over-grants: a dependency recheck classified every one of them:

- **31 functions** are private callees of `SECURITY INVOKER` wrappers in `rebuild_v2`. The wrapper runs as `authenticated`, so the role needs EXECUTE on the private callee even though the callee itself is not an exposed REST endpoint.
- **11 functions** are referenced by RLS or Storage policies: `has_role`, `can_manage_app_icon`, `can_access_developer_feedback_attachment`, and the upload/read helpers for test evidence, support attachments, test assets, and test builds. These grants are needed while evaluating those policies.
- **4 functions** have explicit authenticated EXECUTE grants but no call sites in any user-defined function or policy were found: `grant_role`, `post_wallet_entry`, `request_developer_role`, and `review_role_request`. The security contract directly exercises `grant_role` and `post_wallet_entry` to verify that callers without a valid identity are rejected; the intended use of the other two grants should be confirmed before changing them.

This dependency map explains all 46 grants as 31 invoker-wrapper dependencies, 11 policy dependencies, and four explicit authorization-gated routines. It does **not** establish a direct PostgREST exploit because `rebuild_v2_private` is not exposed. The remaining review item is whether the four explicit grants are still needed, not a blanket revoke of all private functions.

Inspected guards include:
- `grant_role` checks the caller has the admin role and records an audit event.
- `post_wallet_entry` checks admin/financial role, validates the operation, locks the wallet, enforces idempotency, and records an audit event.
- `create_test_impl` checks the developer role and ownership of a published app.
- `review_test_impl` checks admin role and pending-review state.
- `submit_checkin_impl` checks authenticated identity, assignment ownership, and active status.

Do not revoke the 31 invoker-wrapper or 11 policy-helper grants without redesigning and testing their call paths. Keep the private schema unexposed and add regression tests for both the required invoker/policy permissions and the four explicit grants before any privilege change.

### SECURITY DEFINER search-path verification

A separate catalog audit of all 96 V2 functions found 64 `SECURITY DEFINER` functions. All 64 have an explicit `search_path` setting: 44 use an empty path and 20 use explicit paths composed only of `pg_catalog`, `rebuild_v2`, `rebuild_v2_private`, `auth`, and/or `storage`. No SECURITY DEFINER function is missing a search-path setting, and all are owned by `postgres`.

The non-empty paths are not currently user-writable: `anon`, `authenticated`, and `service_role` have no `CREATE` privilege on any of those schemas. In particular, `authenticated` has `USAGE` but not `CREATE` on the two V2 schemas, which is required for invoker-wrapper execution but does not permit object shadowing. No search-path injection was demonstrated. Preserve these no-CREATE boundaries in future grants and migrations.

A permanent regression contract for these findings was added in [PR #46](https://github.com/laidktif67-sketch/TestDZ/pull/46), merged as `e98e13d806d574b30ef163ff059dfbc4dd2e9733`. It asserts the required V2 schema USAGE grants, denies schema CREATE to `anon`, `authenticated`, `service_role`, and `authenticator`, and checks every SECURITY DEFINER function for an explicit allowlisted search_path and `postgres` ownership. The contract passed in [PR CI run 43979499705](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43979499705) and post-merge [run 43979708488](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43979708488).

### Confirmed live FixLab date defect; candidate-source correction merged

The current live FixLab definition of `rebuild_v2_private.submit_checkin_impl` still uses `CURRENT_DATE` in its lookup, insert, and unique-violation recovery paths. The FixLab database session timezone is `UTC`; during 00:00–00:59 in Algeria, UTC `CURRENT_DATE` can still represent the previous calendar day. This remains a confirmed defect in the hosted FixLab function until a FixLab-only patch is separately validated.

The candidate-source correction is now merged in [PR #44](https://github.com/laidktif67-sketch/TestDZ/pull/44): it computes the Algeria-local date through `rebuild_v2_private.algeria_local_date(timestamptz)` and uses it consistently in discovery, joining, assignment scheduling, and check-in lookup/insert/retry; script 001's check-in default is also Algeria-local. The UTC 23:xx / Algeria 00:xx regression and column-default assertion passed in the Rebuild V2 CI run. Duplicate and concurrency checks from the existing contract remain in place. No hosted FixLab function or data was changed.

### Source-recovery boundary

This inspection recovered live definitions for selected high-impact routines and catalog metadata, but not a complete portable schema source. Function definitions alone do not reconstruct table DDL, constraints, indexes, policies, grants, triggers, Storage buckets/object policies, extensions, or migration ordering. Do not create migration files from partial function excerpts. Continue recovering those object classes and their dependencies before generating canonical migrations.

Supabase CLI v3 changelog and migration guidance were checked before this inspection. No CLI command, DDL, DML, grant change, migration, or hosted mutation was performed.

## 16. FixLab RLS and Storage configuration inventory (read-only, 2026-11-16)

A further read-only catalog inspection recovered the active policy definitions, non-internal trigger definitions, and Storage bucket settings in FixLab.

### RLS policy command distribution

- `rebuild_v2`: 48 policies — 47 SELECT policies and 1 UPDATE policy (`profiles_update_self_v2`, with both USING and WITH CHECK bound to `auth.uid()`). No INSERT, DELETE, or other UPDATE policies were found in this schema snapshot. The V2 write path is therefore intentionally RPC-centric; do not add direct table-write grants/policies as a shortcut.
- `storage.objects`: 18 policies — 7 INSERT, 7 SELECT, 2 UPDATE, and 2 DELETE policies.
- Storage policy predicates delegate to private authorization helpers for app icons, developer feedback attachments, test evidence, support attachments, test assets, and test builds. This makes the private-function EXECUTE privilege inventory directly relevant to Storage policy behavior and must be included in the least-privilege dependency analysis.

### Storage bucket inventory

| Bucket | Public | Max size | Notable allowed MIME types |
|---|---:|---:|---|
| `app-icons` | yes | 512 KiB | PNG, JPEG |
| `avatars` | yes | 2 MiB | JPEG, PNG, WebP |
| `developer-feedback-attachments` | no | 10 MiB | images, text, PDF, ZIP |
| `support-attachments` | no | 10 MiB | images, text, PDF, ZIP |
| `test-assets` | no | 50 MiB | images, video, PDF, text, Office documents |
| `test-builds` | no | 50 MiB | Android APK |
| `test-evidence` | no | 10 MiB | images, text, PDF, ZIP |

The two public buckets (`app-icons`, `avatars`) are recorded as current configuration, not automatically classified as defects. Confirm that public read access is intentional for each bucket and that no private user content is placed there. The remaining five buckets are private.

### Trigger inventory

The 18 non-internal triggers consist of:
- `auth.users`: one after-insert trigger creates the V2 profile, default tester role, and wallet for a new Auth user.
- `rebuild_v2`: six immutability triggers prevent UPDATE/DELETE on audit events, developer-feedback events, fraud events, play opt-in events, support-ticket events, and wallet ledger entries.
- `storage`: eleven platform/storage lifecycle and safety triggers on buckets and objects. These are managed Storage infrastructure and should not be copied into application migrations as if they were app-owned definitions.

### Migration reconstruction implication

The candidate migration source must preserve the exact policy command distribution, each policy's USING/WITH CHECK expressions, bucket privacy/size/MIME configuration, application-owned triggers, and dependency ordering. Do not infer these from table names or regenerate generic owner policies. No policies, buckets, triggers, or database data were changed.


## 17. Rebuild V2 candidate-source and CI revalidation (2026-11-16)

A cross-directory source review found that the 18 numbered scripts in `supabase/rebuild-v2/` are the maintained clean-replay candidate, intentionally separate from the historical `supabase/migrations/` directory. The candidate README defines their order and explicitly prohibits moving them into the active migration path or applying them to Production before the remaining gates pass.

### Candidate database inventory

Read-only FixLab catalog checks and the candidate README agree on the following final-state shape:

- 47 tables in `rebuild_v2`; all 47 have both RLS enabled and FORCE RLS enabled.
- 439 columns, 297 constraints (47 primary keys, 87 foreign keys, 32 unique constraints, 131 check constraints), and 157 indexes.
- 39 functions in `rebuild_v2` and 57 in `rebuild_v2_private` (96 total).
- 48 application RLS policies; seven Storage buckets and 18 Storage object policies.
- Six application-owned V2 triggers; platform-managed Storage lifecycle triggers are separate.
- One sequence; no views/materialized views or enum types in the candidate schema.
- Six installed extensions: `pg_stat_statements` 1.11, `pgcrypto` 1.3, `pgtap` 1.3.3, `plpgsql` 1.0, `supabase_vault` 0.3.2, and `uuid-ossp` 1.1.

The hosted FixLab migration history remains 21 records. Its history is not a direct manifest of the 18 candidate files; initial fixture/setup entries and later feature changes were recorded at a different granularity. Keep the history intact until a reviewed baseline/reconciliation procedure exists.

### Latest CI evidence

On governance commit `06feb4e711f9286af39f44d228782d9411b7802e`, both relevant GitHub Actions runs completed successfully:

- Rebuild V2 isolated database tests: [run 43973675098](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43973675098), all 18 candidate scripts applied to a disposable local Supabase stack, followed by the phase-one security contract and eight post-phase contracts.
- Frontend typecheck and build: [run 43973675024](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43973675024), including the tester data-boundary check, TypeScript typecheck, and production build.

These results validate that commit and those local CI workflows only. They do not prove exact equivalence with hosted FixLab, legacy public-schema compatibility, or Production readiness.

### Algeria-local calendar correction — merged

The candidate had timezone-sensitive calendar logic in three places: seven `CURRENT_DATE` uses in tester discovery, joining, and daily check-ins in script 007; two schedule-window checks in script 017; and the default value for `checkins.checkin_date` in script 001. With the database session timezone set to UTC, these could use yesterday's date during 00:00–00:59 in Algeria.

[PR #44](https://github.com/laidktif67-sketch/TestDZ/pull/44) was squash-merged into `rebuild/testdz-v2` as commit `6a60e6f04ba05d6af6ee962a306e795c39fa2eb7`. It:
- Adds a private deterministic `algeria_local_date(timestamptz)` helper.
- Uses that helper for tester discovery, joining, assignment schedule checks, and check-in lookup/insert/retry.
- Changes the `checkins.checkin_date` default to an explicit `Africa/Algiers` local-date expression.
- Adds fixed UTC-to-Algeria boundary assertions and a catalog assertion for the column default.

Validation passed:
- Rebuild V2 isolated database CI [run 43975152683](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43975152683): all 18 candidate scripts and all nine SQL contracts passed on a disposable local Supabase stack.
- Legacy migration regression CI [run 43975152708](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43975152708) also completed successfully. It exercised the separate legacy migration path.
- The tester contract confirmed the UTC 23:30 → Algeria 00:30 boundary and the check-in date default; all synthetic fixtures were rolled back.

No hosted database was changed. The live FixLab functions and column default remain unpatched until a separately reviewed FixLab-only validation step.

### Remaining source-of-truth decision

Treat `supabase/rebuild-v2/` as the current candidate replay source, not as an approved production migration sequence. Before any schema cutover:
1. Keep the successful empty-database replay of all 18 scripts as a required CI gate; rerun it after every candidate SQL change.
2. Export and compare complete catalogs against FixLab: columns/defaults, constraints, indexes, functions and security attributes, grants, policies, triggers, extensions, buckets, and Storage policies.
3. Resolve the 24 legacy `public` tables and the frontend feature-flag compatibility path.
4. Only then propose a canonical migration-history baseline, backup/restore rehearsal, and explicit cutover/rollback plan.
5. Keep Production, Auth users, Storage objects, and hosted migration history untouched until separate approval.


## 18. Local PostgREST schema exposure alignment (2026-11-16)

A local-runtime compatibility gap was found after the V2 date correction:

- The frontend's V2 client explicitly selects `.schema("rebuild_v2")` when `VITE_TESTER_WORKFLOW_V2_ENABLED=true`.
- FixLab's live PostgREST configuration exposes `rebuild_v2` and does not expose `rebuild_v2_private`.
- The committed local `supabase/config.toml` exposed only `public` and `graphql_public`, so a fresh local stack would not match the schema selection expected by the V2 frontend.
- The existing Rebuild V2 CI exercised SQL directly through PostgreSQL and therefore did not detect this PostgREST exposure mismatch.

[PR #45](https://github.com/laidktif67-sketch/TestDZ/pull/45) adds `rebuild_v2` to the local `api.schemas` list while keeping `rebuild_v2_private` excluded. It adds a local-only `supabase/seed.sql` bootstrap that creates the empty `rebuild_v2` schema before PostgREST starts; the 18 ordered candidate scripts remain the source for all application objects. The Rebuild V2 workflow then checks authenticated access to `rebuild_v2.profiles` and verifies that `rebuild_v2_private` is rejected as an unexposed schema.

The legacy migration workflow is now scoped to PRs targeting `main` or `architecture-v1` and to legacy migration/test/config paths. It starts PostgreSQL only because it runs SQL tests, not API tests. The Rebuild V2 workflow also watches `supabase/seed.sql` and `supabase/config.toml` so future bootstrap/config changes cannot bypass validation.

PR #45 was squash-merged into `rebuild/testdz-v2` as `e8cb30e6494f56af9ecc42be72ba31073d9a49e3`. Both the PR validation [run 43978239147](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43978239147) and the post-merge push validation [run 43978743410](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43978743410) passed. The local seed ran before PostgREST startup; authenticated access to `rebuild_v2.profiles` succeeded and the private schema probe was rejected.

The existing `project_id` in `supabase/config.toml` remains unchanged and still identifies Production. The seed is local initialization, not a migration. No remote CLI command, hosted API setting, database schema, data, Auth user, Storage object, or deployment was changed.

Do not add `rebuild_v2_private` to PostgREST's exposed schema list. The private schema is an internal implementation boundary, not a browser-facing API.


## 19. FixLab migration-history inventory and consolidation map (2026-11-16)

A fresh read-only query of `supabase_migrations.schema_migrations` on FixLab returned 21 records. The records split into an earlier FixLab fixture/legacy group and a later V2 development group. The V2 branch's active `supabase/migrations` directory currently ends at `20261112000100_support_ticket_conversations.sql`; it does not contain the November 15–16 FixLab history files.

### Pre-V2 / fixture / legacy history (8 records)

| Version | Recorded name | Current treatment |
|---|---|---|
| `20261115095605` | `fixlab_initial_core_schema_fixture` | Historical FixLab fixture; not copied into the V2 candidate replay |
| `20261115095608` | `test_details_only_schema_candidate` | Historical test-details prototype |
| `20261115095618` | `enable_pgtap_for_fixlab` | Test infrastructure, not an application-schema migration |
| `20261115101419` | `fixlab_split_test_detail_owner_policies` | Legacy/prototype ownership-policy change |
| `20261115101706` | `fixlab_enforce_test_app_developer_ownership` | Legacy/prototype ownership enforcement |
| `20261115102554` | `restrict_test_detail_table_grants` | Legacy/prototype table-grant restriction |
| `20261115102751` | `fix_android_package_name_validation` | Historical validation patch |
| `20261115102836` | `restrict_test_lifecycle_column_writes` | Legacy/prototype lifecycle write restriction |

These rows remain part of the hosted FixLab audit history. They are not a reason to replay the old fixture schema into the V2 candidate.

### V2 development history (13 records)

| Version | Recorded name | Consolidated candidate area |
|---|---|---|
| `20261115160318` | `rebuild_v2_sandbox_namespace` | `001_schema.sql` and `002_security.sql` — V2 namespace and security foundation |
| `20261115193304` | `fixlab_v2_developer_lifecycle_candidate` | `008_developer_lifecycle.sql` |
| `20261115193600` | `fixlab_lock_app_edits_during_review` | `009_lock_app_edits_during_review.sql` |
| `20261115193720` | `fixlab_guard_test_cohort_capacity` | `010_guard_test_cohort_capacity.sql` |
| `20261116145646` | `fixlab_v2_test_content_authoring` | `011_test_content_authoring.sql` |
| `20261116145833` | `fixlab_v2_test_content_authoring_validation` | Consolidated with `011_test_content_authoring.sql` |
| `20261116150813` | `fixlab_v2_cohort_management` | `012_cohort_management.sql` |
| `20261116151440` | `fixlab_v2_private_test_builds` | `013_private_test_builds.sql` |
| `20261116151830` | `fixlab_v2_harden_test_build_storage_helper` | `014_harden_test_build_storage_helper.sql` |
| `20261116153736` | `fixlab_v2_private_test_media_assets` | `015_private_test_media_assets.sql` |
| `20261116154657` | `fixlab_v2_private_developer_feedback` | `016_private_developer_feedback.sql` |
| `20261116162502` | `enforce_assignment_schedule` | `017_enforce_assignment_schedule.sql` |
| `20261116162951` | `verify_submission_evidence_metadata` | `018_verify_submission_evidence_metadata.sql` |

The mapping above is a consolidation map based on the recorded migration names and the ordered candidate README; it is **not** a claim that each hosted history row is byte-for-byte equivalent to one candidate file. Some hosted records are combined into a single candidate script. Exact live-to-clean object comparison remains a separate required gate.

### Consequences

- Keep the 21 hosted history rows intact. Do not delete, rewrite, or mark them as a new baseline yet.
- Do not create empty placeholder files for missing timestamped versions. The V2 source of truth is the ordered 18-script candidate sequence under `supabase/rebuild-v2/`.
- Do not move the 18 candidate scripts into `supabase/migrations/` while that directory still represents the earlier public/legacy migration lineage.
- Complete the catalog-level comparison (columns/defaults, constraints, indexes, function bodies and attributes, grants, RLS/Storage policies, triggers, buckets, extensions) before any FixLab baseline/history repair.
- Any future FixLab-only patch must have a tracked SQL source and an explicit history/version plan; no Production migration or history operation is authorized by this inventory.


## 20. Read-only FixLab-to-candidate object and column parity (2026-11-16)

The live FixLab catalog was compared against the 18 ordered candidate scripts by object names. This is stronger than count-only comparison, but it is still not a full definition/hash comparison.

| Object class | FixLab live | Candidate source final set | Name parity |
|---|---:|---:|---|
| Base tables in `rebuild_v2` | 47 | 47 | Exact set match; no missing or extra table names |
| Column names across those tables | 439 | 439 | Exact set match per table; no missing or extra column names |
| Functions in `rebuild_v2` + `rebuild_v2_private` | 96 | 97 | All 96 live names exist in source; candidate has one additional helper |
| Policies in `rebuild_v2` + `storage` | 66 | 66 | Exact final set match after applying source DROP POLICY statements |
| Application triggers in `auth` + `rebuild_v2` | 7 | 7 | Exact set match |

The one candidate-only function is `rebuild_v2_private.algeria_local_date`. Its absence in live FixLab is expected from the confirmed check-in date defect: candidate source now uses the Algeria-local date helper, while live FixLab's `submit_checkin_impl` still uses UTC-sensitive `CURRENT_DATE`. This is the remaining known function-name delta and a live FixLab patch candidate, not a reason to change the candidate baseline.

The 11 triggers in the `storage` schema are Supabase Storage platform lifecycle triggers and are intentionally not recreated by application scripts. The 66 policy comparison includes 48 application-schema policies and 18 Storage object policies; three temporary policies created in an earlier candidate step are dropped by the later privacy script, so they are absent from the final candidate set just as they are in FixLab.

**Still not proven:** column types/defaults/nullability, constraint definitions, index definitions/validity, function bodies and full signatures, grants, bucket configuration, and exact Storage policy expressions. Complete those comparisons before applying a live FixLab patch or rebuilding migration history. No hosted database object was changed during this comparison.
