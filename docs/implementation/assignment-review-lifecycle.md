# Assignment Review Lifecycle — Implementation Contract

Status: implementation design, not production-ready
Base reference: `rebuild/testdz-v2` at `9a973cfb2d970f37c2bd8523584d29c9c1622ea0`
Work branch: `work/assignment-review-lifecycle`

## Scope

Replace the current "tester submission completes assignment" behavior with a review lifecycle. This document is a contract for the migration and contract tests; it does not authorize applying SQL to a hosted Supabase project.

## Current behavior confirmed on the base reference

- `assignment_submissions.assignment_id` is UNIQUE, so only one report record can exist per assignment.
- Submission status is constrained to `draft` or `submitted`.
- `finalize_assignment_submission_impl` verifies evidence Storage ownership, MIME, and size, then sets the submission to `submitted` and the assignment to `completed`.
- There is no developer RPC for approving a final assignment report or requesting changes.
- Developer feedback review is a separate workflow and must not be treated as approval of feedback quality or final assignment completion.

## Target state model

Assignment remains `active` while a report is under review. It becomes `completed` only after an authorized developer approval or a guarded automatic approval.

Submission states:

- `draft`: editable by the owning tester; attachments may be registered.
- `submitted`: immutable report awaiting developer review.
- `changes_requested`: reviewed with a mandatory explanation; tester may create a new attempt.
- `approved`: developer approved; assignment transitions to `completed`.
- `auto_approved`: the 72-hour rule approved the report after all eligibility checks; assignment transitions to `completed`.

A report decision is immutable. A resubmission creates a new attempt; prior attempts and their evidence remain available for audit. At most one `draft` or `submitted` attempt may exist for an assignment at a time. A completed assignment cannot accept another attempt.

## Required data changes

1. Replace the unique constraint on `assignment_submissions.assignment_id` with an `attempt_number` and unique `(assignment_id, attempt_number)`.
2. Add a partial unique index allowing at most one open attempt per assignment (`draft` or `submitted`).
3. Extend status constraints and add review metadata: `reviewed_by`, `reviewed_at`, `review_note`, `review_due_at`, `reminder_sent_at`, and `auto_approved_at`.
4. Add an append-only review-decision history table with actor, decision, reason, and timestamp. Enforce immutability using the existing immutable-record trigger pattern.
5. Preserve existing identity foreign keys and attachment composite foreign keys.

## RPC behavior

### Tester

- Create/update only the current draft attempt.
- After `changes_requested`, create the next attempt number; do not overwrite the prior report.
- Register attachments only while the attempt is a draft.
- Finalize only after all submission prerequisites are met and every attachment's Storage owner, size, and MIME match the registered metadata.
- Finalization changes the submission to `submitted`; it MUST NOT complete the assignment or grant a reward.

### Developer

- Only the developer who owns the associated test may review a submitted attempt.
- Lock the assignment and submission rows before deciding.
- Permit exactly one decision for each submitted attempt.
- `approved` completes the assignment exactly once.
- `changes_requested` requires a meaningful review note and leaves the assignment active.
- Every decision writes an append-only audit record and enqueues one idempotent notification event.
- A developer must not approve another developer's test or alter tester identity/evidence ownership.

### Automatic approval

- Use a server-only function; never grant it to authenticated clients.
- It may approve only a submitted attempt whose review deadline has elapsed.
- Re-check every prerequisite at decision time and lock rows.
- Do not auto-approve if a dispute, appeal, or blocking review is open.
- The 48-hour reminder is queued once; 72-hour auto-approval is idempotent.
- Automatic approval must not issue a financial reward or wallet entry.

## Prerequisite invariants

- 14 valid daily check-ins must be verified by database logic, not a UI count.
- Approved medical-exception dates are schedule extensions, not check-ins. Each approved date adds exactly one calendar day; pending requests do not pause the schedule.
- Feedback quality acceptance is a separate decision from developer feedback triage. The submission gate must use the explicit quality state, not `developer_feedback_reviews.review_status`.
- The final evidence verification introduced by migration 018 must be preserved.

The current V2 candidate does not yet provide the complete medical-exception decision RPC or a clear feedback-quality review RPC. Those dependencies must be implemented and tested before the finalization gate is enabled; do not silently treat legacy `public` schema functions as V2 functionality.

## Contract tests required before merge

1. Tester cannot finalize with fewer than 14 valid check-ins.
2. Missing day, duplicate day, out-of-order day, and an unapproved exception do not satisfy the gate.
3. An approved exception extends the schedule by exactly one day and never counts as a check-in.
4. Pending medical request does not pause or extend the schedule.
5. Pending/rejected feedback quality does not satisfy the gate; accepted quality does.
6. Finalization leaves assignment `active` and submission `submitted`.
7. Owning developer can approve; non-owning developer, tester, support, and financial roles cannot.
8. Approval completes assignment once; duplicate decisions are rejected/idempotent as specified.
9. Request-changes requires a reason and allows a new attempt without deleting old attempts or evidence.
10. A second open attempt cannot be created concurrently.
11. 48-hour reminder is queued once.
12. 72-hour auto-approval only runs after deadline and re-checks all gates.
13. An open dispute blocks automatic approval.
14. Auto-approval never writes wallet or payout records.
15. Evidence owner, size, MIME, and attachment count constraints remain enforced.
16. RLS and Storage access remain limited to tester, owning developer, and explicitly authorized staff scopes.

## Rollout and safety

- Replay the complete candidate SQL chain in a disposable local database first.
- Update the existing `007_tester_workflow_contract.sql`; it currently expects one check-in and pending feedback to be sufficient for immediate completion, so that assertion must be replaced.
- Add focused contracts for developer review, attempt history, scheduler idempotency, and concurrency.
- Run typecheck, build, all SQL contracts, and Storage/RLS contracts against the same commit.
- Do not apply candidate SQL to hosted Supabase, change feature flags, merge, or deploy until the reviewed PR is explicitly approved.


## Implementation progress on the work branch

The first candidate migration is now present as
`supabase/rebuild-v2/036_assignment_review_lifecycle.sql`.

It currently:
- Converts the existing report into attempt 1 and adds attempt numbering.
- Allows only one open draft/submitted attempt per assignment while preserving prior
  `changes_requested` attempts and their evidence.
- Adds review metadata and an append-only, one-decision-per-attempt review history.
- Adds an owning-developer-only review RPC for `approved` and
  `changes_requested`; approval completes the assignment, while a requested revision
  leaves it active.
- Writes an audit event and queues an idempotently dispatchable notification event.
- Replaces the unsafe immediate-completion finalizer with a fail-closed response.

### Deliberate incomplete state

The finalizer currently raises
`SUBMISSION_PREREQUISITES_NOT_IMPLEMENTED` for every authenticated call. This is
intentional: the 14-day consecutive check-in rule, explicit Feedback quality decision,
V2 medical-exception review and date accounting, and full evidence verification have
not yet been implemented together. It is safer to temporarily block finalization on
this candidate branch than to preserve the old behavior that marked an assignment
completed before review.

The existing `007_tester_workflow_contract.sql` has been updated to assert this
fail-closed behavior and that the assignment remains active. Its previous successful
finalization and evidence-mismatch assertions are deferred until the complete gate is
implemented in a later migration.

### Validation status

- Git diff was checked against the pinned base; the branch is ahead of the pinned base and
  has no divergence from it.
- SQL was reviewed statically from the repository source.
- The candidate migration and SQL contract have **not** yet been replayed against a
  disposable PostgreSQL/Supabase database. No claim of passing SQL execution is made.
- No hosted Supabase database, feature flag, production branch, PR, or deployment was
  changed.


A focused integration contract was also added at
`supabase/rebuild-v2/tests/036_assignment_review_lifecycle_contract.sql`. It covers
non-owning developer denial, mandatory revision reason, immutable attempt history,
attempt-number increment, owning-developer approval, single-decision enforcement,
audit records, and notification enqueueing. It has not yet been executed against
PostgreSQL; source-level inspection is not a passing test result.

- The isolated SQL workflow was updated to expect 36 numbered candidate scripts
  and to run the new `036_assignment_review_lifecycle_contract.sql` contract.
- No CI run is currently attached to this work branch: the workflow runs on pushes
  to the official branch or on pull requests. No pull request has been opened.
- GitHub reports no commit status checks for the latest work-branch commit; this is
  not equivalent to a successful test run.

- Isolated GitHub Actions run `46044484272` started from commit
  `ec888467a6034c7194a8d55af72e263666b1225d`. At the latest inspection,
  frontend typecheck and Edge Function typecheck had succeeded; the disposable
  Supabase database job was still starting, so SQL replay and contracts remain
  unconfirmed.

### First isolated SQL replay and correction

The first disposable Supabase replay successfully applied all numbered migrations
through `036_assignment_review_lifecycle.sql`. It then stopped in
`tests/final_state_contract.sql` because the contract still expected 48 tables,
while migration 036 intentionally added the 49th table. The migration itself
did not fail to apply.

The final-state contract has been updated to expect 49 tables and 49 RLS/FORCE-RLS
tables. The new review-history table has RLS and FORCE RLS enabled, no client
policies, and no client grants; its trusted SECURITY DEFINER lifecycle RPCs remain
the intended access path.

A second isolated run, `46044714103`, is checking this correction. At the latest
inspection, frontend TypeScript and Edge Function checks passed; the disposable
database stack was still starting, so the second SQL replay and the new lifecycle
contract have not yet reported a result.


## Verified policy decisions and validation — 2026-11-27

This section supersedes the earlier in-progress validation notes above.

### Binding medical-exception policy

The Master Blueprint is authoritative:

- Only a user with the 'admin' role may approve or reject a medical exception. 'support' is not an approver.
- A tester submits one or more specific dates (1–14), a reason (20–4000 characters), and optional evidence. A pending request does not pause the assignment and does not change its due date.
- Every approved requested date adds exactly one calendar day to the assignment schedule. An approved date is an excused calendar day, not a check-in and not reward-bearing activity.
- An approved date must not overlap an existing check-in or another approved exception date for the same assignment. Duplicate/overlapping dates must never add a second extension.
- Rejection adds no extension. Both decisions must retain reviewer identity, timestamp and decision note, audit before/after state, and notify the tester.
- The existing 'assignments.medical_extension_days' and 'medical_exception_requests' schema are the source structures; do not create a parallel exception model.
- Medical evidence is sensitive. Keep request/review operations behind narrow RPCs and admin-only access. Do not broaden Support access to raw check-ins, feedback, or medical evidence. The V2 support boundary migration deliberately removed Support from direct SELECT access to assignments, check-ins and feedback.

### 14-day completion interpretation

- Completion requires 14 valid TestDZ check-ins on 14 required, non-excused calendar dates.
- Every required date must have exactly one check-in. The unique key on '(assignment_id, checkin_date)' remains the duplicate guard.
- Approved excused dates are skipped when evaluating required check-in dates and extend the calendar window by exactly one day each; they do not increment the 14-check-in count.
- Any non-excused missed required date is an interruption and fails the assignment. A pending exception is not an approved excuse and cannot suppress that failure.
- All date calculations use 'Africa/Algiers' local dates, independent of database session timezone.
- The feedback-quality gate is separate from developer feedback triage. Only 'feedback.quality_status = accepted' satisfies it; 'pending' or 'rejected' does not.
- Developer approval remains a separate final confirmation after the tester has met the 14-day and feedback-quality gates.

### Current migration and test state

- Migration '036_assignment_review_lifecycle.sql' is present on 'work/assignment-review-lifecycle'. It adds attempt history, one-open-attempt enforcement, immutable review decisions, owner-developer review authorization, audit/outbox writes, and a fail-closed finalization/approval gate.
- The approval and finalization gates intentionally return 'SUBMISSION_PREREQUISITES_NOT_IMPLEMENTED' until the complete 14-day, feedback-quality, medical-exception and evidence checks are implemented together. This branch is not launch-ready.
- The first full SQL replay found a contract-fixture defect: the second attempt was still a 'draft' when the test tried to review it. The test now explicitly transitions its synthetic fixture to 'submitted', matching the state expected by the review RPC.
- GitHub Actions run 46045865794 (commit 4c9ddad96180cfbea32d21cec2642586eefd6579) completed successfully: isolated Supabase migration/contracts, frontend typecheck, and notification/invitation Edge Function typecheck all passed.
- The successful run validates migration 036 and the current SQL contracts only. It does not validate the still-unimplemented completion gates, scheduler, or hosted Supabase state.

### Next implementation boundary

Migration 037 must implement and test the remaining prerequisites as one fail-closed unit before either finalization or approval can be enabled:

1. Admin-only medical-exception review RPCs and tester request RPC, with date-range validation, overlap protection, idempotent schedule extension, audit, and outbox notification.
2. Explicit feedback-quality review RPC and audit/notification path, without reusing developer feedback triage.
3. Database-enforced check-in sequence and 14 valid required dates using Algeria-local dates and approved-exception exclusions.
4. One shared prerequisite function used by both finalization and developer approval, including attachment metadata/Storage ownership verification.
5. Contract tests for pending/approved/rejected/overlapping exceptions, missed dates, duplicate dates, 14/14, feedback quality, role boundaries, concurrency and idempotency.
6. Keep 48-hour reminders and 72-hour auto-approval server-only and disabled until a verified scheduler invocation exists. Auto-approval must re-check every prerequisite and must never create wallet/reward entries.

No hosted Supabase writes, merge, PR, feature-flag change, or deployment is authorized by this validation.


## Migration 037 validation — 2026-11-27

Migration `037_medical_exception_and_feedback_quality.sql` and its contract were added to the isolated candidate chain.

Verified by GitHub Actions run [46046795027](https://github.com/laidktif67-sketch/TestDZ/actions/runs/46046795027), commit `effb57a13d3f09bc72e95a519f4450f17439d977`:

- All 37 numbered candidate SQL scripts applied successfully to a disposable local Supabase stack.
- `final_state_contract.sql` passed with the new private medical-evidence bucket.
- `037_medical_exception_and_feedback_quality_contract.sql` passed.
- Existing tester workflow, assignment review, privacy, wallet, support, invitations and other SQL contracts passed.
- Frontend TypeScript and notification/invitation Edge Function typechecks passed.

Migration 037 currently provides:
- A dedicated private `medical-exception-evidence` bucket (5 MiB; JPEG/PNG/WebP/PDF).
- Tester-owned request creation, date validation, one pending request per assignment, and overlap/duplicate/check-in protections.
- Evidence registration only after Storage owner/size/MIME verification.
- Admin-only approval/rejection, assignment locking, one extension day per approved date, before/after audit metadata and tester notification.
- Admin-only feedback quality review, separate from developer triage, with a one-way pending → accepted/rejected decision, audit metadata and tester notification.

Important remaining boundaries:
- This run validates the local candidate only; no hosted Supabase writes occurred.
- Feedback quality and medical decisions now exist, but the 14-day check-in sequence and shared completion prerequisite evaluator are not implemented yet.
- Migration 036's finalization and developer approval remain deliberately fail-closed.
- No reward, points, wallet, or payment is issued by these review RPCs.
- Medical evidence access is limited to the request's tester and Admin; Support and developers are not granted access.


## Migration 038 validation — 2026-11-27

Migration `038_enforce_14_day_assignment_completion.sql` is now in the candidate chain.

GitHub Actions run [46048012009](https://github.com/laidktif67-sketch/TestDZ/actions/runs/46048012009) completed successfully on the current branch:
- All 38 numbered candidate SQL migrations applied to disposable local Supabase.
- The final-state contract passed.
- The updated legacy tester workflow and assignment-review contracts passed against the live prerequisite evaluator.
- Medical exception/feedback quality contract 037 passed.
- The new `038_14_day_assignment_completion_contract.sql` passed.
- All remaining SQL contracts and local PostgREST schema-exposure checks passed.
- Frontend TypeScript and notification/invitation Edge Function typechecks passed.

Migration 038 now enforces:
- Exactly 14 valid check-ins across required Algeria-local dates; only approved medical dates are skipped.
- A missed non-excused prior day marks the assignment failed, writes audit metadata and enqueues a tester notification. The RPC returns NULL after committing this state rather than raising and rolling it back.
- The missed-day evaluator stops at the fourteenth required day; it does not punish a tester for not checking in after the 14-day requirement has already been met.
- Finalization requires 14 valid check-ins, accepted feedback quality, no pending medical exception, and verified attachment metadata/Storage ownership.
- Tester finalization moves only the report to submitted; the assignment stays active.
- Developer approval re-runs the same prerequisite evaluator and only then completes the assignment.
- A 72-hour review deadline is recorded; no automatic approval, reminder scheduler, wallet credit, or payment is activated.

The first run after the 038 addition caught one stale assertion in the older 007 contract that still expected the previous fail-closed error code. The assertion was updated to the current prerequisite error; the subsequent complete run above passed. No production database was modified, and no merge, PR, or deployment was performed.


## Workflow UI integration — 2026-11-27

The V2 lifecycle now has explicit application entry points and role-separated screens:

- Tester: `/assignments/:id/medical-exception` submits 1–14 elapsed dates, a reason, and optional private evidence; shows the tester's request history and supports attaching evidence to a pending request.
- Admin: `/admin/assignment-lifecycle-reviews` reviews pending medical exceptions and feedback quality. It requires Admin role, decision notes, and obtains short-lived signed URLs for medical evidence.
- Developer: `/developer-assignment-reviews` lists only submitted reports visible through the existing developer RLS policy, shows report attachments using short-lived signed URLs, and calls the audited approve/changes-requested RPC.
- Tester progress now renders approved medical dates as excused calendar days, keeps the requirement at 14 valid check-ins, extends the calendar end date, and disables check-in on an approved medical date.
- When the server marks an assignment failed after an unexcused missed day, the tester API re-reads the committed status and the page displays the interruption state rather than a misleading generic retry.

Frontend CI run [46049609028](https://github.com/laidktif67-sketch/TestDZ/actions/runs/46049609028) passed on commit `a1e8e7f0e9ef0647aa409dd84ebc513cc0c14794`:
- Tester-page data-boundary check passed (all page data access remains behind feature APIs).
- TypeScript typecheck passed.
- Production build passed.

Remaining launch gates:
- No 48-hour reminder or 72-hour auto-approval scheduler is enabled. The 72-hour review deadline is recorded only.
- No wallet/reward/payment side effects are connected to report approval.
- Feedback-quality rejection currently blocks completion; a controlled tester feedback-revision flow still needs a product decision and implementation.
- The new UI is guarded by the V2 feature flag and has not been deployed or pointed at hosted Supabase.
