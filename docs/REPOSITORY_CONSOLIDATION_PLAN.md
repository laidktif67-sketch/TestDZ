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
- The FixLab table inventory returned 47 tables in `rebuild_v2`, alongside legacy `public` tables. RLS was reported enabled on all returned tables. The private schema has no tables in this inventory; it contains internal routines, not application tables.

This confirms the migration reproducibility blocker remains open. The hosted migration history is not represented by matching checked-in SQL files, and the seven missing paths cannot be reconstructed from version/name metadata alone. Do not create placeholder migrations, mark these versions as applied in Git, run `db reset`, run `db push`, or change either hosted project to make the histories appear aligned.

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

### Security interpretation — least-privilege gap, not yet a proven API exploit

The private schema was previously confirmed absent from the PostgREST exposed-schema list. That prevents treating these functions as ordinary exposed RPC endpoints through the configured REST schema list. However, the current database grants still allow `authenticated` to use the schema and directly execute 46 private routines, 46 of which are SECURITY DEFINER. This is broader than the intended "private implementation" boundary and should be treated as a confirmed least-privilege gap.

A direct exploit through the application's current PostgREST route has **not** been demonstrated. Several inspected implementations independently enforce authorization:
- `grant_role` checks the caller has the admin role and records an audit event.
- `post_wallet_entry` checks admin/financial role, validates the operation, locks the wallet, enforces idempotency, and records an audit event.
- `create_test_impl` checks the developer role and ownership of a published app.
- `review_test_impl` checks admin role and pending-review state.
- `submit_checkin_impl` checks authenticated identity, assignment ownership, and active status.

These guards reduce the impact of direct invocation for the inspected routines, but do not justify granting broad EXECUTE on private SECURITY DEFINER helpers. Before any grant change, enumerate every caller/dependency and prove wrappers execute as an owner that retains required privileges. Then test that authenticated users cannot invoke private functions directly while public wrapper RPCs continue to work. Do not apply blanket REVOKE statements based only on this inventory.

### Confirmed check-in date defect remains in live FixLab definition

The current live definition of `rebuild_v2_private.submit_checkin_impl` still uses `CURRENT_DATE` in its lookup, insert, and unique-violation recovery paths. The FixLab database session timezone is `UTC`; the inspected timestamp was `2026-11-16 22:48:54+00`, which is `23:48:54` in `Africa/Algiers`. Therefore, during the first hour after midnight in Algeria (00:00–00:59), UTC `CURRENT_DATE` can still represent the previous calendar day. This is a confirmed timezone-dependent defect in the live function definition, although the current read-only sample was not itself inside the rollover hour.

Proposed correction remains to calculate one explicit `v_checkin_date := (now() AT TIME ZONE 'Africa/Algiers')::date` and use it consistently for lookup, insert, and unique-violation recovery. Required tests must simulate UTC 23:xx / Algeria 00:xx, duplicate submissions, and concurrent submissions. No fix was applied.

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
