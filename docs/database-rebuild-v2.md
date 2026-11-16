# TestDZ database rebuild v2 — candidate

## Status and source of truth

This is an isolated rebuild candidate, not a production migration.

- Working branch: `rebuild/testdz-v2`.
- Supabase validation project: TestDZ-FixLab (`bxjqwqidmxxnsgnpyzxv`).
- Candidate schema: `rebuild_v2`; helper schema: `rebuild_v2_private`.
- Candidate source: the 18 ordered SQL scripts in `supabase/rebuild-v2/`.
- The candidate scripts remain outside `supabase/migrations` until live-to-clean catalog comparison, legacy-schema scope, application compatibility, security review, backup, and rollback gates are complete.
- Production project `naqjjykcglxiobkmdllj` has not been modified by this rebuild work.

## Candidate model

The final candidate contains 47 tables and seven Storage buckets.

The model covers identity and authorization, developer apps and tests, tester assignments and evidence, cohorts, moderation and trust, financial wallets and ledger, subscriptions and payments, support workflows, notifications, and developer feedback.

## Security decisions

- RLS is enabled and forced on all 47 candidate tables.
- User roles include `tester`, `developer`, `admin`, `financial`, and `support`.
- Signup creates only the default `tester` role. User-editable Auth metadata is not used to assign privileged roles.
- `admin`, `financial`, and `support` are not self-selectable. Admin bootstrap is an out-of-band trusted operation; an existing admin may grant permitted staff roles.
- Financial ledger entries are append-only, idempotent, row-locked, balance-checked, and audited. Only admin/financial roles can post wallet entries.
- Security-definer helpers live in the private schema, use fixed search paths, and are not executable by anon.
- Private Storage buckets enforce owner/participant checks and metadata verification for test builds, media, feedback attachments, support attachments, and submitted evidence.

## Validation completed (2026-11-16)

- GitHub Actions run [#8](https://github.com/laidktif67-sketch/TestDZ/actions/runs/43944382982), commit `665ea461430c958132108c2310d5c11a59469d6c`, completed successfully.
- CI built a disposable local Supabase stack, applied all 18 candidate SQL scripts in numeric order, passed all nine contracts (the phase-one security contract plus eight post-phase contracts), and stopped the stack successfully.
- The wallet idempotency contract returned `rebuild_v2_wallet_idempotency_contract: PASS`.
- Contract fixtures were rolled back. The final-state cleanup check reported zero remaining app, profile, and auth-user fixtures.
- Read-only FixLab inventory confirmed 47 `rebuild_v2` tables, RLS and FORCE RLS on all 47, 439 columns, 297 constraints, 157 indexes, 48 candidate RLS policies, 96 candidate functions (39 in `rebuild_v2`, 57 in `rebuild_v2_private`), six candidate triggers, seven Storage buckets, and 18 Storage object policies.
- FixLab's `post_wallet_entry` definition was read back and confirmed to compare the full idempotency identity: user, wallet type, amount, entry type, reference type/id, actor, and reason.
- FixLab's current hosted migration history still contains 21 records. No history repair/reset has been performed.

## Important scope finding: legacy public schema

FixLab also contains 24 tables in the `public` schema, alongside the 47 candidate tables in `rebuild_v2`. The current frontend source selects `rebuild_v2` only when `VITE_TESTER_WORKFLOW_V2_ENABLED === "true"`; when the flag is false or unset, several core API modules use the legacy default `public` schema.

Therefore, the 18 candidate scripts are a reproducible baseline for the V2 candidate schema, but they are not yet proven to be a complete baseline for every currently supported application path. Before replacing the old migration history, decide whether:
1. the legacy `public` schema remains part of the supported product and must be represented in the replacement baseline; or
2. all active routes and APIs are deliberately cut over to V2, with compatibility and rollback tests, before the legacy schema is excluded.

FixLab's security advisor also reports four INFO findings for legacy public tables with RLS enabled but no policies: `public.audit_logs`, `public.fraud_reviews`, `public.platform_config`, and `public.user_roles`. These tables are deny-by-default for ordinary roles under RLS, but their intended use and grants still need review before retaining or retiring the legacy schema. The current statistics estimate zero live rows in all 24 public tables; this is an estimate, not a substitute for a final preservation check.

## Remaining validation gates

1. **Exact live-to-clean comparison:** compare columns, constraints, indexes, function bodies and security attributes, policies, grants, triggers, extensions, and Storage bucket configuration between FixLab and a clean replay. CI proves clean replay and contract behavior; it does not by itself prove complete catalog equivalence.
2. **Legacy-schema decision:** determine whether the public schema remains in scope or whether V2 cutover is required before establishing a V2-only baseline.
3. **Frontend compatibility:** complete route/API-to-SQL mapping, including roles, tester rewards, referrals, reports, leaderboard privacy, and admin workflows.
4. **Security follow-up:** resolve or explicitly document the four legacy public-schema advisor findings.
5. **Backup and restore:** verify a restorable Production backup and rehearse restoration before any production migration.
6. **Data preservation:** approve explicit mappings for existing Auth users, Storage buckets/objects, and any data that must be retained.
7. **Cutover and rollback:** prepare a tested rollback plan and obtain explicit approval before any Production action.

## Migration-history provenance finding

A fresh comparison on 2026-11-16 found 31 SQL files under the repository's current `supabase/migrations/` directory and 21 records in FixLab's hosted `supabase_migrations.schema_migrations` history. **None of the 21 hosted version timestamps matches any of the 31 repository migration filenames.** The hosted history names are FixLab-specific records (including fixture, candidate, and hardening steps), while the checked-in migration files are the earlier legacy sequence.

This means the two histories cannot be treated as a simple one-to-one list. Before any hosted history repair:
- preserve the complete 21-row FixLab history inventory (version and name) in the archive;
- identify which current candidate SQL files fully supersede each FixLab-only schema change;
- identify whether any FixLab-only change is not represented in the 18 candidate scripts;
- archive the 31 repository legacy migration files separately;
- verify the exact target project ref and expected resulting history table before running any repair.

The SQL bodies of the 21 hosted history records are not returned by the migration-list API. Do not claim they have been archived as SQL unless they are independently recovered and checked in. The current V2 candidate may represent their final schema effects, but that equivalence still requires verification.

## Migration-history strategy

The approved direction is to preserve the existing candidate schema and data, archive old migration files in Git rather than permanently deleting them, and establish a new baseline/history only after clean replay, catalog comparison, and legacy-schema scope are resolved. The 21 existing FixLab migration-history records must not be removed until the replacement baseline is verified and the exact history operation is reviewed. Do not change Production migration history.

## Safety boundary

- Do not apply candidate scripts to Production.
- Do not drop or reset the existing FixLab candidate schema or its data as part of this validation.
- Do not delete Auth users or Storage objects.
- Do not run `supabase db pull` against FixLab as a shortcut; CLI v3 defaults and hosted migration-history behavior must be considered before any hosted command.
- Do not change `supabase/config.toml` project targeting or run a hosted CLI command until the target project ref is explicitly verified.
- No Production cutover is authorized by this document.


## Approved architecture decision (2026-11-16): V2 only

The product owner explicitly approved the following target architecture:

- `rebuild_v2` is the sole application data/API schema after cutover.
- `rebuild_v2_private` remains internal and must never be exposed through PostgREST.
- The old `public` application schema is legacy and will no longer be an active application data source after cutover.
- The legacy schema and migration files are preserved during the transition; this approval is not permission to drop tables, delete rows, reset Auth, or delete Storage objects now.
- Supabase Auth remains the shared authentication service. The frontend's Supabase client must continue using the project's Auth and Storage services while its database calls are routed explicitly to `rebuild_v2`.
- The current `VITE_TESTER_WORKFLOW_V2_ENABLED` switch is transitional. Do not flip it in Production or remove the fallback until the application compatibility gates below pass and a separately approved deployment/cutover is ready.

## V2-only cutover work plan

### Phase A — application contract migration (repository work only)

1. Replace the transitional dual-schema selection with one central, typed V2 Data API client once all callers have been mapped. Keep Auth and Storage access on the base Supabase client; route table and RPC calls through the V2 schema client.
2. Migrate every direct `supabase.from(...)` and `supabase.rpc(...)` call in pages/hooks/components to feature API modules. No page should choose a database schema itself.
3. Reconcile confirmed field/table mismatches before enabling the corresponding page:
   - `points_ledger` → canonical `wallet_ledger` contract; read-only UI must not write ledger entries.
   - `assignments.start_date` / `points_awarded` → explicit V2 schedule fields and server-owned reward/ledger semantics.
   - `checkins.evidence_url` → private `evidence_path` plus an authorized signed-URL flow where a UI preview is required.
   - `profiles.subscription_tier` → derive from the canonical subscription/plan relation; do not add a duplicate client-maintained profile field.
4. Replace direct support ticket/message/attachment writes with the V2 RPCs; replace notification read-state updates with `mark_notification_read` / `mark_all_notifications_read`.
5. Redesign the leaderboard as an opt-in, privacy-safe aggregate RPC/view. Do not weaken profile, role, or wallet-ledger RLS to support client-side enumeration.
6. Keep withdrawal UI explicitly preview-only; no withdrawal/payout flow is authorized. Do not connect referral rewards or test rewards to wallet posting until their server-side contracts and business rules are approved.
7. Complete admin and financial staff workflows only after their role boundaries and UI/API contracts are designed. Missing UI must not be replaced with broad table grants.
8. Make the feedback and report forms state clearly that they are not submitted until their validated V2 submission RPC and attachment flow exist. Do not imply that UI-only forms persist data.

### Phase B — verification gates

- Add route/API contract tests that fail if application modules access the default `public` schema for application data.
- Add tests for all mapped table fields, RPC argument/result shapes, Storage upload/download paths, and Auth role routing.
- Verify that every active route works against a clean V2 database with synthetic users for tester, developer, admin, financial, and support roles.
- Verify cross-user isolation, staff-only access, and negative cases. In particular, the leaderboard must not reveal private profile or financial information.
- Run TypeScript, production build, unit/integration tests, and the isolated Supabase replay workflow. Record actual results; do not infer build success from SQL CI.
- Review the Supabase security advisor and Storage policies after the final application contract is wired.

### Phase C — database baseline and hosted cutover (separate approval required)

- Produce a clean V2 baseline only after Phases A and B are complete.
- Archive the 31 legacy repository migrations and the 21 FixLab history records/inventory without losing their provenance. Recover hosted migration SQL where possible; version/name inventory alone is not a SQL archive.
- Compare the clean baseline against FixLab's complete catalog before any history operation.
- Take and verify a restorable backup of the target project; rehearse rollback.
- Apply the V2 schema to the intended hosted target only after explicit project-ref verification and a separate approval. Production is not implicitly authorized by this architecture decision.
- Cut over the frontend environment flag only when the exact target project contains the verified V2 schema, PostgREST exposes `rebuild_v2`, and all production compatibility gates pass.
- Keep `public` intact through a monitored rollback window. Drop/retire it only after explicit approval and proof that no application, scheduled job, integration, or external client depends on it.

## Current known compatibility blockers (must be resolved before cutover)
- **PostgREST exposure is a separate test gate:** the checked-in `supabase/config.toml` currently lists only `public` and `graphql_public` under `[api].schemas`, while the FixLab project was separately configured to expose `rebuild_v2`. The disposable CI workflow applies SQL and runs contracts through direct PostgreSQL connections; it does not prove that PostgREST exposes `rebuild_v2` or that the frontend's `.schema("rebuild_v2")` calls work over the Data API. Add a local API smoke test and reconcile the local config only after replacing the Production project identifier with a safe local identifier and reviewing the current Supabase CLI configuration guidance. Never copy the Production project ref into a command that could mutate a hosted project.

- Core developer app APIs and profile APIs have transitional V2 selection, but the V2 feature flag still permits fallback to `public`.
- Identity role retrieval has transitional V2 selection; signup/session/Auth operations remain on Supabase Auth as intended.
- The compatibility audit identifies direct legacy-schema usage in tester pages for points ledger, assignment reward/date fields, check-in evidence, support writes, notifications, privacy export, and leaderboard aggregation.
- The leaderboard's current cross-user client queries conflict with the intended V2 privacy model; this is a blocker, not a reason to weaken RLS.
- Feedback submission and problem reports are UI-only in the reviewed pages; referrals have no connected data workflow; withdrawal remains preview-only.
- Admin/staff UI and API coverage is incomplete. V2 schema presence alone does not make those workflows operational.

This decision establishes the target architecture. It does not certify application cutover readiness and does not authorize a hosted database change or deployment.


## Frontend V2 cutover progress — 2026-11-16

- Added `apps/web/src/lib/supabase-data.ts` as the central application Data API selector. Auth and Storage continue using the base Supabase client; application table/RPC access is being consolidated behind the selector.
- Routed `features/apps/apps-api.ts`, `features/profiles/profiles-api.ts`, `shared/auth/identity-api.ts`, and the developer dashboard profile read through the central selector.
- The selector intentionally retains the transitional feature-flag fallback. It is not yet safe to remove because the frontend inventory still finds V2/public branching in tester activity, assignment, wallet, support, notifications, privacy export, referral, and withdrawal-display pages.
- Added `docs/v2-frontend-cutover-inventory.md` with the confirmed remaining page-level migration inventory and implementation order.
- Added `.github/workflows/frontend-ci.yml`. Run `43946437297` passed on code commit `589fa2a8d2f69e4f2a208493fe4eb7fb7362d75e`: `npm ci`, `npm run typecheck`, and `npm run build` all succeeded. The existing TestDZ CI run `43946437375` also passed on the same code commit.
- The earlier frontend run `43946352807` failed on a helper return-type mismatch; the type was corrected and the later run passed. The earlier failure is retained here for provenance, not treated as current.
- No Supabase project, database schema, migration history, Storage object, Auth user, Vercel setting, deployment, or PR #18 was changed in this work.


### Tester data-access extraction — 2026-11-16

- Added `apps/web/src/features/tester/tester-api.ts` to own database queries for the tester dashboard, test discovery, and My Tests screens.
- `TesterDashboardPage.tsx`, `DiscoverTestsPage.tsx`, and `MyTestsPage.tsx` no longer contain application table/RPC queries; they retain base-client Auth/session handling only.
- The API module preserves the current legacy/V2 query differences without changing DB contracts or turning on rewards. In V2, discovery continues through `get_discoverable_tests`; assignment timestamps are mapped from `started_at/assigned_at`; reward balances remain display-only and reward posting stays disabled.
- Verification on commit `74749b107773367afe88f9ad9e58ef2b6dbe254f`: frontend CI run `43947071159` passed (`npm ci`, TypeScript, production build); TestDZ CI run `43947070976` passed.
- Remaining page-level database access is still present in assignment progress/submission, check-in/activity/feedback history, leaderboard, wallet, support, notification, privacy export, referrals, and withdrawal-display routes. The feature flag and legacy fallback remain required until those routes are migrated and the isolated PostgREST smoke test is complete.


- Follow-up: moved `ActivityHistoryPage.tsx` database reads into `getActivityHistoryPageData()` in the same tester feature API module. The page now retains only Auth/session access; V2 uses `wallet_ledger` and the legacy path continues to use `points_ledger` inside the API boundary.
- Verification on commit `9ffa3907b24cb796c9aec5f68d8068699a462ba2`: frontend CI run `43947466076` passed and TestDZ CI run `43947466077` passed, including TypeScript and production build.
