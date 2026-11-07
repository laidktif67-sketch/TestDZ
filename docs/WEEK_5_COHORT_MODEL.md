# Week 5 — Cohorts and Assignment Model

**Status:** implementation specification; no database migration is authorized by this document.  
**Target:** TestDZ only.  
**Base:** `feat/week-4-design-system`.

## 1. Product model (binding)

A cohort contains **13 distinct developer-members**. Each member contributes exactly one eligible test owned by that same developer. Each developer tests the other 12 members' tests and never their own.

For a full cohort:

- 13 developer-members
- 13 cohort tests (one per member)
- 12 assignments per tester
- 156 assignments total (`13 × 12`)
- zero self-assignments
- every tester is assigned to 12 distinct tests
- every cohort test receives 12 testers

The cohort capacity is the number of developer-members, not the number of assignments.

## 2. Lifecycle and reuse

- A test may belong to at most one **active** cohort at a time.
- A test may be selected again after its previous cohort is completed or cancelled.
- A cohort's membership and test set must not be silently changed after the cohort enters a running state.
- Formation must be atomic: either all required members/tests/assignments are created, or none are.
- Repeated formation requests must be idempotent and must not create duplicate assignments.

## 3. Database invariants

The implementation must enforce these invariants at the database boundary, not only in React:

1. One member row per developer per cohort.
2. One selected test per developer-member and one owner per selected test in a cohort.
3. Every selected test exists and its `developer_id` matches the cohort member.
4. An assignment's tester is a member of the same cohort.
5. An assignment's test belongs to the same cohort.
6. An assignment's tester is not the owner of the assigned test.
7. A tester can have multiple assignments in a cohort, but only one assignment per test.
8. Cohort capacity counts members, and cannot be exceeded under concurrent formation.
9. A test cannot be active in two cohorts concurrently, including under concurrent requests.
10. Completed/cancelled cohorts release tests for future cohorts without erasing historical assignments.

Prefer normalized relational tables and composite foreign keys where they can prove membership/test relationships. Avoid a UUID array as the authoritative relationship store: PostgreSQL cannot attach ordinary foreign keys to each array element. Any trigger/RPC is additional validation, not a replacement for referential constraints where constraints are possible.

## 4. Existing-schema compatibility

The current schema has:

- `public.cohorts.test_id` (legacy one-test-per-cohort design)
- `public.assignments.test_id`
- `UNIQUE (cohort_id, tester_id)` on assignments

The existing assignment uniqueness rule is incompatible with 12 tests per tester in one cohort and must be replaced with a rule that prevents duplicate assignment of the same test to the same tester while allowing 12 distinct tests.

Before any DDL is applied, the migration must explicitly inspect and safely handle the legacy cohort-to-test relationship, foreign keys, indexes, RLS policies, grants, triggers, functions, and views. Do not assume the live database still has zero rows merely because an earlier audit did.

## 5. Transaction/API requirements

Cohort formation must be a single trusted transaction with:

- authenticated developer authorization and explicit eligibility checks;
- deterministic locking to prevent capacity and active-test races;
- validation of exactly 13 distinct developers and 13 owned tests;
- generation of the 156 non-self assignments;
- a final assertion of all counts before commit;
- idempotency protection for retries;
- no client ability to forge membership, owner, capacity, or assignment rows.

Keep privileged implementation in the non-exposed `private` schema where appropriate. Use a narrow exposed wrapper only if the client needs it, with fixed `search_path`, explicit caller checks, and minimal EXECUTE grants. Do not add broad SECURITY DEFINER functions or recursive RLS policy dependencies.

## 6. Required acceptance tests

A migration/test harness is not acceptable unless it proves all of the following:

### Valid cohort
- 13 unique developers and 13 tests with matching owners are accepted.
- Exactly 13 members and 13 cohort tests are stored.
- Exactly 156 assignments are created.
- Every tester has exactly 12 assignments.
- Every cohort test has exactly 12 testers.
- No tester is assigned their own test.
- All 12 tests assigned to a tester are distinct.

### Invalid or adversarial cases
- 12 developers: rejected without partial writes.
- 14 developers: rejected without partial writes.
- Duplicate developer: rejected.
- Duplicate test: rejected.
- Test owned by a different developer: rejected.
- Non-member tester: rejected.
- Self-assignment: rejected on both INSERT and UPDATE.
- Duplicate `(cohort_id, test_id, tester_id)`: rejected.
- 14th member under concurrent requests: only one transaction may win; capacity is never exceeded.
- Same test concurrently selected by two active cohorts: only one transaction may win.
- Retry of the same formation request: no duplicate cohort or assignments.
- Completed/cancelled cohort: test can be reused in a later cohort.
- Running cohort: membership/test set cannot be mutated through direct client writes.
- RLS tests use separate authenticated identities (not only SQL running as postgres).

### Regression and security
- Existing assignment/check-in/feedback access still works for authorized owners/testers.
- Unauthorized users cannot read or mutate another cohort's data.
- Policies avoid self-recursive table references.
- No service-role secret or production test data is added to the repository.
- All pre-existing migration files remain immutable.


## 8. Confirmed live-database findings (read-only audit, 2026-11-07)

The live TestDZ database was inspected without changing its schema or data:

- PostgreSQL 17.11; 28 public tables.
- `cohorts`, `assignments`, and `tests` currently contain zero rows.
- Applied migration history ends at `20261106001500_harden_app_validation`.
- The live unique constraint is `assignments_cohort_id_tester_id_key` on `(cohort_id, tester_id)`.
- `cohorts.test_id` has a foreign key to `tests(id)`.
- The cohort SELECT policy currently references `cohorts.test_id` and contains the malformed tester predicate `a.cohort_id = a.id`.
- Authenticated currently has SELECT grants on cohorts and assignments; no direct INSERT/UPDATE grants were observed for those roles.
- Cohort and assignment tables have only their `set_updated_at` triggers in the inspected trigger inventory.
- Supabase security advisors returned no lints during this audit.

Migration 016 must explicitly drop/recreate the cohort SELECT policy before dropping `cohorts.test_id`, and must replace the malformed tester predicate with a membership-based predicate that does not create RLS recursion. Preserve the current read-only client grant boundary unless the approved API design requires a narrower explicit change.

The zero-row observation is a snapshot, not a permanent assumption. Re-run preflight checks immediately before applying any migration.

## 9. Release gate

1. Review the final relational model and migration SQL.
2. Validate the migration against a disposable PostgreSQL test database or isolated test environment.
3. Run all positive, negative, concurrency, RLS, and regression tests.
4. Review Supabase security/performance advisors.
5. Inspect the exact SQL diff and migration history.
6. Obtain explicit founder approval before applying Migration 016 to the production TestDZ project.

**Do not apply Migration 016 to production as part of this specification step.**
