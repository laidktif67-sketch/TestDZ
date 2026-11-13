# CLAUDE.md — TestDZ Backend Engineering Context

## Product and architecture
- TestDZ is a two-sided marketplace for Android closed-test campaigns: Tester and Developer.
- A campaign's core testing period is 14 days. Algeria is the initial market; MVP is PWA/Web only.
- Stack: React 18, TypeScript, Vite 6, React Router 7, Tailwind, npm workspaces, and Supabase (Auth, PostgreSQL, RLS, Storage, migrations).

## Source-of-truth documents
- Review `AUDIT_REPORT.md`, `LAUNCH_PLAN.md`, `SECURITY_REPORT.md`, and `UX_REPORT.md` before work that touches their areas.
- If documents conflict, prefer `LAUNCH_PLAN.md`, then `SECURITY_REPORT.md`, while recording unresolved conflicts.

## Fixed product decisions
- MVP excludes payments, Chargily, subscriptions, withdrawals, referrals, and leaderboards.
- Points are non-cash; do not imply DZD value, transfer, or withdrawal.
- Arabic, French, and English are required throughout the product.
- Medical exemptions are decided by Admin only.
- A ban takes effect immediately for sensitive operations, including already-authenticated sessions.

## Environments and deployment safety
- `TestDZ-Rebuild` is the only intended staging project.
- Never access, modify, deploy to, or run migrations against the legacy `TestDZ` project or production.
- Do not use the remote Rebuild database for current tests. All RLS and migration tests run against local Supabase only.
- Preparing or using remote Rebuild as staging is a separate future step and requires the owner's explicit approval.
- Never print, log, commit, or expose secrets, access tokens, database URLs, or passwords.
- Any deployment workflow must fail closed unless its target is explicitly and independently verified as the intended Rebuild project and GitHub Environment protection requires approval.
- Migrations marked `staging-only` must never be selected or pushed by an automatic workflow. No remote push is permitted as part of local CI.

## Database and authorization rules
- Never add broad/public SELECT access to `profiles`; preserve self/admin access and use narrow, ownership-checked RPCs for explicitly approved public fields.
- Never weaken RLS to make tests pass.
- Never use `user_metadata` as an authorization source. Use trusted database role assignments.
- Every database change requires a new migration; never rewrite or amend an already-existing migration.
- Every database change must include positive and negative SQL regression tests for relevant roles and ownership boundaries.
- Sensitive RPCs must validate caller identity, role, ownership, and ban status server-side; use a locked-down search path for SECURITY DEFINER functions.
- Medical data minimization is mandatory: do not store medical documents or detailed reasons unless the owner has explicitly approved the minimum necessary data model.

## Working method
- Use one focused branch per task, created from the explicitly identified current branch head.
- Make small, reviewable changes with clear commit messages.
- Reproduce a reported defect with a failing test before implementing its fix. If it cannot be reproduced, document that and do not guess.
- Run Supabase migrations and SQL regression tests locally only. Do not run migrations on any remote database.
- Do not proceed to the next ordered task until the current task's relevant tests pass.
- Do not merge a PR until typecheck, build, and relevant regression tests pass and the owner explicitly authorizes merge.
- Keep the PR open and Draft unless the owner says otherwise.

## Reporting and honesty
- Distinguish verified behavior from source inspection and assumptions.
- Report exactly which commands/tests ran, their outcomes, and what could not be tested.
- Never claim a build, test, migration, deployment, or runtime verification succeeded unless it actually ran and passed.
