# TestDZ-Rebuild — RLS behavioral test matrix (2026-11-15)

## Environment and limits

Target is the isolated Supabase project `TestDZ-Rebuild` (`ouzppgsvwsgtqyabkwjk`). Do not run this plan against the legacy `TestDZ` project. No persistent fixture rows or Auth users were created during this review. The database is still not certified for production.

## Policy catalog review performed

Read-only inspection of `pg_policies` confirmed the following current policy intent in the test project:

- `profiles`: authenticated users may select themselves (or an admin may select); updates must remain on their own `id`.
- `apps`: authenticated insert requires the caller to be `developer_id`, unless admin; select allows published apps, own apps, or admin; update is owner/admin only.
- `tests`: insert requires a matching app/developer relationship and a draft/recruiting status, plus owner/admin; select allows owner/admin or tests belonging to a published app; update owner/admin only.
- `support_tickets`: insert requires caller ownership, open status, and a matching requester role; reads are owner with matching role or support staff; updates support-staff only.
- `support_ticket_messages`: insert requires sender identity, a non-closed ticket and requester-role membership, or support staff; reads are ticket participants/support staff.
- `developer_feedback_messages`: sender must be caller and caller must be the feedback tester or the developer assigned to the feedback's test.
- `developer_feedback_attachments`: uploader, path prefix and message author must match the caller; reads are limited to the tester or assigned developer.
- `medical_exception_requests`: insert is restricted to the assigned tester and pending/unreviewed request constraints; reads are owner/admin; updates are admin-only.

This is a static policy-expression review, not proof that the policies behave correctly with real identities and rows.

## Required test matrix

Use disposable Auth identities and fixture rows in the isolated test project only. Keep service-role credentials server-side. Record request status, response body class (redacting tokens/PII), and before/after row counts. Clean up fixtures in dependency order after each scenario.

| Area | Identity/scenario | Expected outcome |
|---|---|---|
| Profiles | User A selects own profile | Own row visible |
| Profiles | User A selects User B profile | User B row not visible |
| Profiles | User A attempts to update User B profile ID | No row changed / request denied |
| Apps | Developer A creates app with developer_id A | Allowed when required fields valid |
| Apps | Developer A creates app with developer_id B | Denied |
| Apps | Developer A updates Developer B app | Denied / no row changed |
| Apps | Authenticated user selects unpublished app owned by B | Not visible to A |
| Apps | Authenticated user selects published app | Visible according to current policy |
| Tests | Developer A inserts test tied to B's app | Denied |
| Tests | Developer A inserts test tied to own app with invalid status | Denied |
| Support tickets | User A creates ticket with own ID and a role actually granted to A | Allowed |
| Support tickets | User A creates ticket with mismatched requester role | Denied |
| Support tickets | User B reads A's ticket or messages | Not visible |
| Support tickets | Non-support user updates ticket status | Denied |
| Feedback messages | Tester/assigned developer sends message as self | Allowed |
| Feedback messages | Unrelated user sends message or impersonates another sender | Denied |
| Attachments metadata | User uploads metadata with another user's path prefix | Denied |
| Medical exceptions | Assigned tester creates valid pending request | Allowed only when all assignment/date checks pass |
| Medical exceptions | Unrelated user creates request for another tester's assignment | Denied |
| Medical exceptions | Non-admin attempts to update review/status fields | Denied |

## How to run safely

1. Create temporary Auth users only if the test operator has a documented cleanup route and can delete those users afterwards. Never place access tokens or service-role secrets in this repository.
2. Seed minimum fixture data through a trusted administrative test harness, capturing all generated IDs. Do not bypass foreign keys or triggers to make a scenario pass.
3. Call the actual Supabase Auth/PostgREST APIs with each user's JWT. SQL `SET ROLE`/JWT-claim simulations alone do not count as API-level evidence.
4. For every expected denial, assert both the HTTP outcome and that no unauthorized row/object changed.
5. Test Storage via its HTTP API separately: owner upload/read/update/delete, cross-user attempts, malformed paths, and public-read only for intended public buckets.
6. Delete only the known disposable fixtures and temporary test users; verify cleanup counts.
7. Record failures before changing policies. Fix only demonstrated defects, then rerun both allowed and denied paths.

## Current evidence

- Static policy expressions inspected on 2026-11-15.
- Anonymous execution of `create_app_with_distribution` denied with `42501`.
- Simulated authenticated call without identity denied with `28000 AUTH_REQUIRED`.
- Earlier simulated non-admin cohort-management calls denied with `42501 ADMIN_ONLY`.
- These are smoke checks only. Real-identity owner/non-owner API tests and Storage HTTP tests remain outstanding.
- Four migrations remain held pending separate reviews; do not apply them as part of this test plan.
