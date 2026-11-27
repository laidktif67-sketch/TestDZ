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
