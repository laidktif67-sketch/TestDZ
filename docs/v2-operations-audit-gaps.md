# V2 Operations Audit: Remaining Event and Workflow Gaps

**Audit baseline:** candidate SQL files `supabase/rebuild-v2/001_schema.sql` through `024_audited_support_ticket_workflow.sql` proposed on PR #76, based on PR #73 head `9e8f0223b1c1760f229c8fb7f791e8c3ee8fc854`. PR #76 remains Draft; exact-head isolated replay and all 21 post-phase contracts passed, while manual visual QA remains outstanding.

**Scope:** read-only source review. This document does not authorize or perform hosted database changes, Production writes, Edge Function deployment, secrets changes, cron creation, or migration cutover.

## Confirmed implemented controls

- `audit_events`, `fraud_events`, `support_ticket_events`, `developer_feedback_events`, and `wallet_ledger` have immutability triggers in the candidate security baseline.
- Wallet ledger posting is restricted to Admin/Financial through the private `post_wallet_entry` implementation, validates an idempotency key and reason, records actor/reference details, and writes an audit event.
- Admin role grants are constrained by candidate migration `023_admin_role_grants.sql`: Admin cannot be granted through the wrapper, self-grants are rejected, reasons are required, and duplicate grants do not create duplicate audit events.
- Developer feedback status/priority changes and replies write actor-attributed `developer_feedback_events`; notification events are separate from the audit trail.
- Financial Operations (PR #61) is intentionally read-only. PR #74 retains and surfaces useful payment, refund, and ledger trace fields; it does not enable financial mutations.

## Gaps found in the candidate SQL

### 1. Fraud signal and review lifecycle is not wired

- `fraud_events` is defined and protected against UPDATE/DELETE, but no producer INSERT into this table was found in candidate SQL 001–023.
- `fraud_reviews` has a read policy and an Admin/Support read-only queue surface (PR #65), but no candidate RPC was found to claim, resolve, dismiss, or otherwise transition a review.
- The immutable event table and review queue therefore exist as data structures, not as a complete operational fraud workflow.

**Recommended next phase:** define trusted signal producers and a service-owned scoring/review creation boundary; then add Admin-only review transition RPCs with actor, decision, reason, timestamps, and immutable audit events. Do not expose raw signal evidence to Support by default. Add local SQL contracts for unauthorized transitions, self-service signal fabrication, duplicate signal ingestion, and immutable history.

### 2. Support ticket lifecycle — core workflow implemented in PR #76, validation pending

- PR #76 adds `message_sent` to the immutable `support_ticket_events` stream and records every public reply with its actor and timestamp.
- Staff replies create an Admin-visible `audit_events` entry linked to the message ID; message bodies are not copied into audit metadata.
- New `update_support_ticket` RPC locks the ticket, validates Support/Admin roles and legal state transitions, requires a 10–1000 character reason, and atomically updates status/priority with actor-attributed ticket events and an immutable audit record.
- Support cannot reopen resolved or closed tickets; only Admin can reopen them. Closed tickets remain terminal for Support.
- The Support detail workspace displays ticket metadata, public messages, and event history; internal notes and attachment contents are excluded.
- Contract `tests/020_support_ticket_audited_workflow_contract.sql` covers role boundaries, status transitions, audit attribution, no-op/invalid reason rejection, reply events, and append-only history. The exact-head isolated replay of all 24 candidate scripts and 21 post-phase contracts passed on PR #76 head `214a67fbeaef044962b4476079cfe9d5b08f01b7` (run #44309843867).

**Remaining Support work:** assignment management, an explicit internal-note workflow with separate visibility rules, staff attachment review/download with audited access, and notification integration are not part of PR #76 and must be designed separately. Do not expose internal notes or attachment contents through the current detail page.

### 3. Payments and refunds are schema-only for now

- Candidate SQL defines `payments` and `refunds` with useful trace fields, but no create/verify/approve/process RPC or trusted provider callback handler was found in candidate SQL 001–023.
- PR #61 deliberately provides a read-only view. The page must not imply that a payment can be verified or a refund can be approved/processed.
- Refund status values and `approved_by` columns do not, by themselves, constitute an operational refund workflow.

**Recommended next phase:** first document the payment provider, webhook authenticity model, idempotency rules, reconciliation policy, and legal/business refund policy. Only then design service-only payment state transitions and a separately authorized refund decision/processing flow. Wallet credits for refunds must be a distinct, idempotent ledger operation with an explicit reference to the refund. Do not add placeholder buttons or simulate successful provider actions.

## Implementation order

1. Keep the current financial page read-only and preserve all trace fields.
2. Perform PR #76 mobile/desktop/RTL visual QA; keep assignment, internal notes, attachment review, and notifications as separate scoped work.
3. Define trusted fraud signal ingestion and Admin review lifecycle contracts.
4. Validate provider and refund policy before designing payment/refund mutations.
5. Keep all candidate changes isolated until compatibility, backup, rollback, and cutover gates are approved.

## Safety boundary

This is a candidate-only audit record. No hosted database was queried or modified for this review. No Production migration, data deletion, Edge deployment, secret update, scheduled job, Vercel Preview, or PR merge was performed.
