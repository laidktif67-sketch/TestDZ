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
