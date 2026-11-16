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
