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
- 45 remote branches.
- 26 open pull requests; all 26 are Draft.
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
