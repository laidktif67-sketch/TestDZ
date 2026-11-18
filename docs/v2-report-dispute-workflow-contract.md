# V2 Report and Dispute Workflow — Design Gates

Status: design/audit document only. This document does not enable intake, review, dispute resolution, refunds, or payment processing.

## 1. Current verified model

### Reports

The candidate `rebuild_v2.reports` table currently contains:

- `reporter_id` (required)
- `reported_user_id` (nullable)
- `assignment_id` (nullable)
- `report_type` (required; constrained to `no_activity`, `fake_feedback`, `app_broken`, `harassment`, `payment_dispute`, `other`)
- `description` (20–5000 characters)
- `status` (defaults to `open`; constrained to `open`, `under_review`, `resolved`, `rejected`)
- `reviewed_by`, `reviewed_at`, `created_at`

A report may have attachment metadata in `report_attachments`, linked to an assignment, test, tester and report. The table alone is not an intake workflow. Incident-report evidence upload now fails closed until a trusted intake/registration operation inserts an exact metadata row matching the V2 Storage path, file ID, extension, report, assignment and tester; authenticated clients cannot write this metadata table directly.

### Disputes

The candidate `rebuild_v2.disputes` table currently contains:

- `opened_by` (required)
- `payment_id` and `report_id` (at least one must be non-null)
- `status` (defaults to `opened`; constrained to `opened`, `under_review`, `resolved_accepted`, `resolved_rejected`, `escalated`)
- `resolution`, `resolved_by`, `created_at`, `updated_at`

The schema does not currently define a dispute event/history table or a dedicated resolution RPC.

### Payments and refunds

Payments have pending/processing/succeeded/failed/refunded statuses and a required idempotency key. Refunds have requested/approved/rejected/processed statuses and a method of wallet_credit or bank_return. These columns do not establish provider verification, refund execution, wallet credit, or bank return integrations.

## 2. Current behavior and boundaries

- The Report Problem page is explicitly a non-submitting placeholder. It does not create a report or upload evidence.
- The report and dispute queues are read-only metadata views. They do not change statuses or expose report descriptions, evidence, payment amounts, or resolution text.
- Direct authenticated writes to reports, disputes and report attachments remain denied.
- Report visibility is scoped to the reporter and authorized Support/Admin staff. Incident-report Storage reads now follow the same boundary; a related Developer does not gain evidence access merely from owning the test. Assignment-submission evidence retains its separate tester/developer/Support/Admin participant policy.
- Dispute visibility is scoped to the opener and Financial/Admin staff. Support is intentionally excluded from other users' dispute records by the candidate security fix in PR #78.
- Refunds remain read-only. No refund approval, provider execution, bank return, or wallet credit is enabled.
- Fraud review remains fail-closed/read-only until a trusted signal-ingestion path and audited review-decision workflow exist.

## 3. Gaps that must be resolved before implementation

### Report intake

1. Which authenticated roles may submit a report: Tester only, or also Developer and other roles?
2. Must every report reference an assignment, or may a general account/harassment report omit it?
3. Which report types require a reported user, an assignment, or both?
4. Is `payment_dispute` a report category that creates/links a dispute, or should it be removed from report intake in favor of the dedicated dispute workflow?
5. What is the evidence policy: allowed MIME types, maximum file count/size, retention, access roles, malware scanning, and deletion/legal-hold rules?
6. Should users be able to add evidence after submission, and until which state?

### Report review

1. Which role owns triage and assignment: Support, Admin, or a separate investigator role?
2. Can Support resolve/reject reports, or only classify and escalate them?
3. What reason/note is mandatory for each transition?
4. Can a resolved/rejected report be reopened, and by whom?
5. What should the reporter see: status only, a public response, or a redacted resolution?
6. Must every transition create an immutable domain event and an Admin audit event?

### Dispute lifecycle

1. Who may open a dispute: payment owner only, and only after a payment reaches `succeeded`?
2. Can a dispute reference both a payment and a report? If so, which record is authoritative?
3. Which role investigates: Financial only, Admin, or a distinct dispute reviewer?
4. What does `resolved_accepted` mean operationally: a finding only, or a separately approved refund request?
5. What does `resolved_rejected` mean, and what evidence/reason must be retained?
6. Who may escalate, reopen, or close a dispute, and under what conditions?
7. Does dispute resolution ever trigger a refund? If yes, it must create a separate, idempotent, audited refund execution workflow; a dispute decision must never directly mutate a wallet or payment status.

## 4. Required implementation contract

Once product decisions are confirmed, implementation should be split into independently testable boundaries:

1. **Intake RPC** — derives actor from `auth.uid()`; validates ownership, assignment eligibility, allowed report type and description; validates and registers attachment metadata before Storage upload; creates the case atomically; uses an idempotency strategy.
2. **Review/transition RPC** — validates role and state transition server-side; requires a reason where appropriate; locks the target row; updates status/reviewer fields atomically; appends immutable domain history and audit event with actor, target, reason and safe metadata.
3. **Read APIs** — separate public/user detail from Support/Admin and Financial/Admin views; never return private report descriptions or evidence to Financial unless explicitly authorized; do not rely on UI filtering as authorization.
4. **Evidence workflow** — private bucket, opaque V2 paths, metadata registration tied to a real report, uploader ownership and authorized reviewer access; no public URLs.
5. **Refund workflow** — separate from dispute resolution; requires validated provider/legal policy, independent approval authority, idempotent execution, reconciliation and immutable financial ledger/audit records.
6. **Tests** — owner isolation, unrelated-user denial, Support/Financial separation, Admin authority, invalid transitions, reason validation, concurrent transition safety, duplicate/idempotency behavior, attachment ownership, no direct client writes, and rollback-safe disposable database contracts.

## 5. Explicit non-goals until decisions are approved

- Do not invent report or dispute status transitions.
- Do not make the disabled Report Problem button submit.
- Do not upload or register evidence without a guarded metadata-registration workflow.
- Do not add generic Support access to financial disputes.
- Do not mark a payment refunded when a dispute is accepted.
- Do not create wallet credits or bank returns from a report/dispute action.
- Do not deploy candidate SQL or functions to hosted Production.

## 6. Acceptance gates

Before coding a write workflow, obtain an agreed decision for every question in section 3, document the actor/transition matrix, and add failing contract tests first. Keep the implementation candidate-only and Draft until the complete disposable replay, all post-phase contracts, frontend checks, and manual role-by-role UI review pass.
