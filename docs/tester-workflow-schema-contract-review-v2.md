# Tester Workflow — V2 Schema/Frontend Contract Review

Branch: `rebuild/testdz-v2`  
Scope: read-only review of candidate SQL, FixLab catalog metadata, and tester page contracts.  
Safety: no database writes, no Auth users created/deleted, no Storage objects changed, no Production access.

## Verified FixLab baseline

Project: `TestDZ-FixLab` (`bxjqwqidmxxnsgnpyzxv`), PostgreSQL 17.11, ACTIVE_HEALTHY.

- 43 tables in `rebuild_v2`; all 43 have RLS enabled and FORCE RLS.
- 44 RLS policies.
- 6 user-defined triggers on V2 tables.
- 13 exposed RPCs in `rebuild_v2`; none implements tester discovery/enrollment, assignment start, check-in, tester feedback submission, or assignment final submission.
- All V2 tables currently report zero rows.
- Authenticated has SELECT on V2 tables; no direct table INSERT/DELETE grants were found in the role-table grants snapshot. The only intended column-level UPDATE grant is the safe profile-field grant.
- The inspected candidate schema and live FixLab catalog agree on the tester workflow table definitions.

## Confirmed contract mismatches

### Assignment model

V2 `assignments` has:
- `assigned_at`, `started_at`, `completed_at`, `due_at`
- `status`: pending / active / completed / withdrawn / failed / rejected
- no `start_date` and no `points_awarded`

The current pages expect `start_date` and, in some views, `points_awarded`. The V2 adapter must map `started_at` to the UI's start date and must not synthesize points from client data.

### Evidence model

V2 `checkins` stores `evidence_path`; current progress/history pages query `evidence_url`. The new adapter must use private Storage paths and signed URLs at read time; it must not persist public URLs in the database.

### Wallet model

V2 has `wallets.earned_points`, `wallets.purchased_credits`, and immutable `wallet_ledger`. Current tester pages query `points_ledger`, which is not a V2 table. No tester reward-posting RPC exists yet. Do not award points or expose a client-controlled amount in this workflow phase.

The product distinction remains: tester earned points are not developer purchased credits. Cash withdrawal is out of scope.

### Final submission model

The current assignment submission form collects:
- a final results summary (max 2,000 chars),
- optional comments (max 500 chars),
- up to 5 evidence files (PNG/JPG/WebP/PDF, max 10 MB each).

V2 `reports` is an incident/reporting table (report_type values include no_activity, fake_feedback, app_broken, harassment, payment_dispute, other). It is not a final assignment submission table. V2 `report_attachments` references `reports`, so it must not be repurposed for final assignment submissions.

A dedicated assignment-submission entity and attachment metadata model are required before wiring the final submission page. Existing `test-evidence` Storage helpers currently require a matching `reports` row, so they are not yet a valid upload path for the final assignment form.

### Feedback

V2 `feedback` has one row per assignment, with `body` 20–8,000 chars, category enum, optional rating, and server-owned `quality_status` / `reviewed_by` / `reviewed_at`. Submission must be via a narrow RPC that derives tester identity from `auth.uid()` and never accepts review fields from the browser.

Current Submit Feedback page has no backend submission call. Feedback History reads the legacy points ledger and needs a V2 adapter.

## Security finding to fix in the candidate layer

The existing `cohorts_select_participants_v2` policy contains an apparent invalid ownership predicate:

```sql
a.cohort_id = a.id
```

This compares a cohort ID to the assignment's own ID, rather than correlating the assignment to the outer `cohorts.id`. As written, the tester-participant branch cannot grant cohort visibility. A candidate-only replacement policy should correlate `a.cohort_id = cohorts.id` and verify tester ownership. Keep developer/admin/support branches unchanged.

## Enrollment and capacity design constraints

- Enrollment must choose a `cohort_tests` row for the requested test.
- Capacity is stored on `cohorts`, not `tests`; serialize enrollment by locking the selected cohort row and count assignments for that cohort before inserting.
- Keep the unique `(test_id, tester_id)` constraint as a second line of defense.
- Release a seat only for explicitly non-counting states (at minimum withdrawn/rejected); completed or failed participants should not silently free a seat.
- `eligibility_criteria` is currently an unconstrained JSON array with no verified machine-readable contract in the tester UI. Do not invent an eligibility parser. Before automated gating, define and validate its supported JSON shape; until then the RPC should expose criteria as information and apply only verified hard constraints.

## Safe implementation sequence

1. Add a candidate-only SQL file outside active migrations. It should:
   - replace the faulty cohort SELECT policy;
   - add read-only discovery and secure join/start/check-in/feedback RPCs;
   - add a dedicated final assignment-submission table and attachment metadata (do not overload `reports`);
   - update the private Storage helper/policies to bind evidence to the dedicated submission model;
   - keep reward posting out until the tester-points policy and review/approval lifecycle are explicitly defined.
2. Test all RPCs in FixLab with synthetic identities inside rollback-only transactions where feasible. Do not create persistent Auth users or leave test rows/objects behind.
3. Add a separate V2 Supabase client/adapter; do not change the legacy client globally.
4. Integrate one page slice at a time and replace legacy field assumptions with explicit mapping.
5. Run SQL contract tests, cross-user/role/duplicate/capacity race checks, TypeScript, lint, and build.
6. No Production SQL, active migration promotion, PR #18 changes, Auth deletion, or Storage cleanup without explicit approval.

## Status

This is a verified contract review only. No source or database changes were made.
