# Supabase rebuild — static migration scan (2026-11-15)

## Scope and safety

Read-only inspection of all 52 SQL migration files on `feat/developer-create-test-six-step`, plus read-only inspection of the empty `TestDZ-Rebuild` project (`ouzppgsvwsgtqyabkwjk`). No migrations were applied and no data/schema was changed in either Supabase project.

## Verified baseline on TestDZ-Rebuild

- Project status: `ACTIVE_HEALTHY`, PostgreSQL `17.11.0.019`.
- `public` contains no application tables.
- Supabase migration ledger is empty.
- Supabase-managed schemas `auth`, `storage`, `public`, `extensions` exist.
- Standard roles `anon`, `authenticated`, `service_role`, `supabase_auth_admin`, and `supabase_storage_admin` exist.
- Installed extensions include `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `plpgsql`, and `supabase_vault`.

This confirms the project is a viable *candidate* clean target for further validation, not that the migrations are ready to run.

## Static scan of the 52 migration files

Every migration file was fetched from the named branch. The scan identified important operational risks requiring staged validation:

1. The initial migration header says `Dedicated project only: naqjjykcglxiobkmdllj`. This is a warning that the migration set was authored for a specific project. It is not itself an execution guard, but the full migration sequence must be reconciled before reuse on `TestDZ-Rebuild`.
2. Several files have no explicit `BEGIN/COMMIT` wrapper, while many others do. That alone is not proof of failure; these files need to be executed through the actual Supabase migration mechanism in an isolated test and checked for partial-application behavior.
3. The sequence contains operations that drop/recreate functions, policies, triggers, and constraints. These are often legitimate upgrade operations, but their dependencies must be confirmed in order and tests run after each logical group.
4. Multiple migrations reference Supabase-managed `auth` or `storage` objects. The target has those schemas and standard roles, but bucket configuration, Auth trigger assumptions, grants, and actual object dependencies still need explicit checks.
5. The candidate set includes high-impact security migrations:
   - `20261113000400_banned_account_enforcement.sql` installs broad restrictive policies/triggers and storage restrictions.
   - `20261113000500_admin_account_suspension_appeals.sql` creates suspension/appeal workflows and several privileged RPCs.
   These must not be bundled into an unreviewed first-pass bootstrap; they require dedicated behavioral tests.
6. The migrations themselves contain explicit staging/review-only language in at least one report-evidence migration. Treat such annotations as a release gate until confirmed resolved.
7. The previously recorded migration-ledger mismatch, feedback-attachment constraint mismatch, missing candidate FK indexes, and absent cohort pause-policy objects remain unresolved. Static scanning does not resolve those discrepancies.

## Decision

**Do not apply all 52 migrations in one operation yet.** The rebuild project is empty and has the expected Supabase platform schemas/roles, so the path is not blocked; the safe next step is to construct and validate a migration manifest, identify prerequisite objects and any review-only files, then apply only a reviewed bootstrap batch to this rebuild project and verify its resulting schema before proceeding.

Do not modify the old `TestDZ` project, reset either project, run GitHub Actions, merge a PR, or deploy production as part of this step.

## Evidence status

- Migration file inventory: 52 files, fetched and statically scanned.
- Rebuild project baseline: verified read-only.
- SQL parse/runtime execution: **not yet performed**.
- Full migration chain: **not yet applied**.
- RLS/RPC behavior: **not yet validated**.
- Production readiness: **not established**.


## Controlled rebuild execution update (2026-11-15)

A first controlled batch has now been applied successfully to the isolated `TestDZ-Rebuild` project. The old `TestDZ` project was not modified.

Applied in order (22 successful migration executions):
1. `initial_core_schema`
2. `foreign_key_indexes`
3. `master_blueprint_alignment`
4. `auth_bootstrap_and_subscription_read`
5. `coupon_payment_index`
6. `subscription_rpc_invoker_and_admin_reads`
7. `seed_subscription_plans`
8. `events_admin_read_policy`
9. `auth_profiles_onboarding_storage`
10. `onboarding_rpc_private_wrapper`
11. `signup_phone_profile_bootstrap`
12. `auth_bootstrap_verified_state`
13. `apps_crud_storage_and_plan_limits`
14. `app_limit_read_rpc`
15. `harden_app_validation`
16. `cohort_tests_table`
17. `assignments_feedback_constraints`
18. `cohort_triggers_data_migration`
19. `cohort_rpcs`
20. `lock_down_postgres_public_defaults`
21. `harden_user_insert_policies`
22. `restrict_report_assignment_deletion`

### Post-apply verification

Read-only catalog verification after the batch returned:
- 29 public base tables.
- 88 public indexes.
- 39 public RLS policies.
- 3 subscription plans and 15 platform configuration rows.
- 0 rows in `cohort_tests`, `cohorts`, and `assignments` (expected for a fresh project).
- Both intended Auth triggers are present.
- No `pgtap` extension is installed, so the repository pgTAP test files have not been run on this project.

All 22 apply calls returned success, and the Supabase migration ledger records these 22 executions. The tool-generated ledger versions are execution timestamps, not the original migration filenames' version prefixes; this rebuild ledger should not be treated as a byte-for-byte replica of the old project's migration history.

### Explicit hold before the next migration

The next candidate, `20261109203933_add_private_report_evidence.sql`, explicitly says: **“Staging only. This file is prepared for review; do not apply until separately approved.”** It creates the `report_attachments` table and a private evidence storage bucket. It has therefore **not** been applied. Its dependent index migration `20261109204205_index_report_attachments_foreign_keys.sql` has also not been applied.

This is an intentional release gate, not a migration failure. Before crossing it, review the evidence-upload design, bucket access, metadata immutability, and report/assignment ownership behavior. Other later migrations must be checked for dependencies on `report_attachments` before deciding whether to continue around this hold or pause the chain.

### Current status

- Controlled rebuild bootstrap: **22 migrations applied successfully**.
- Schema/catalog postflight: **passed for the checks listed above**.
- pgTAP and behavioral RLS/Auth/Storage tests: **not run**; pgTAP is not installed.
- Report-evidence migrations: **held by explicit approval comment**.
- Remaining migration chain and production readiness: **not yet validated**.
- Old `TestDZ` project: **unchanged**.
