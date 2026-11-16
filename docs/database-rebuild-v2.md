# TestDZ database rebuild v2 — candidate

## Status and source of truth

This is an isolated rebuild candidate, not a production migration.

- Working branch: `rebuild/testdz-v2`.
- Supabase validation project: TestDZ-FixLab (`bxjqwqidmxxnsgnpyzxv`).
- Candidate schema: `rebuild_v2`; helper schema: `rebuild_v2_private`.
- Candidate source: the 18 ordered SQL scripts in `supabase/rebuild-v2/`.
- The candidate scripts remain outside `supabase/migrations` until clean replay, application compatibility, security tests, and rollback planning are complete.
- Production project `naqjjykcglxiobkmdllj` has not been modified by this rebuild work.

## Candidate model

The current candidate contains 47 tables and seven Storage buckets.

The model covers identity and authorization, developer apps and tests, tester assignments and evidence, cohorts, moderation and trust, financial wallets and ledger, subscriptions and payments, support workflows, notifications, and developer feedback.

## Security decisions

- RLS is enabled and forced on all 47 candidate tables.
- User roles include `tester`, `developer`, `admin`, `financial`, and `support`.
- Signup creates only the default `tester` role. User-editable Auth metadata is not used to assign privileged roles.
- `admin`, `financial`, and `support` are not self-selectable. Admin bootstrap is an out-of-band trusted operation; an existing admin may grant permitted staff roles.
- Financial ledger entries are append-only, idempotent, row-locked, balance-checked, and audited. Only admin/financial roles can post wallet entries.
- Security-definer helpers live in the private schema, use fixed search paths, and are not executable by anon.
- Private Storage buckets enforce owner/participant checks and metadata verification for test builds, media, feedback attachments, support attachments, and submitted evidence.

## Validation completed

- The candidate schema and scripts through 018 have been applied to the isolated FixLab candidate schema.
- Live read-only inventory previously confirmed 47 tables in `rebuild_v2`, all 47 with RLS and FORCE RLS, and seven Storage buckets.
- The candidate includes phase-one and later workflow contracts for app lifecycle, profiles, developer lifecycle, private test media, tester workflow, and developer feedback privacy.
- The role matrix and all frontend routes are not yet fully covered by end-to-end tests.
- The final-state contract added alongside this plan still needs to be executed against FixLab and the clean local replay.

## Remaining validation gates

1. **Clean replay:** apply all 18 scripts in numeric order to a disposable empty Supabase local stack and confirm the final 47-table/seven-bucket contract passes.
2. **Contract suite:** run the phase-one security contract after 001–006, then run the final-state and workflow contracts after 001–018.
3. **Frontend compatibility:** complete the route/API-to-SQL mapping, including roles, tester rewards, referrals, reports, leaderboard privacy, and admin workflows.
4. **CI:** add an isolated workflow that applies the candidate scripts themselves; the existing migration workflow only tests `supabase/migrations` and does not validate this candidate directory.
5. **Backup and restore:** verify a restorable Production backup and rehearse restoration before any production migration.
6. **Data preservation:** approve explicit mappings for existing Auth users, Storage buckets/objects, and any data that must be retained.
7. **Cutover and rollback:** prepare a tested rollback plan and obtain explicit approval before any Production action.

## Migration-history strategy

The approved direction is to preserve the existing candidate schema and data, archive the old migration files in Git rather than permanently deleting them, and establish a new baseline/history only after a clean replay is proven. The 21 existing FixLab migration-history records must not be removed until the replacement baseline is verified and the exact history operation is reviewed. Do not change Production migration history.

## Safety boundary

- Do not apply candidate scripts to Production.
- Do not drop or reset the existing FixLab candidate schema or its data as part of this validation.
- Do not delete Auth users or Storage objects.
- Do not run `supabase db pull` against FixLab as a shortcut; the current CLI v3 defaults and remote-history behavior must be considered before any hosted command.
- Do not change `supabase/config.toml` project targeting or run a hosted CLI command until the target project ref is explicitly verified.
- No Production cutover is authorized by this document.
