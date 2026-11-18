# V2 Operations Audit: Remaining Event and Workflow Gaps

**Audit baseline:** candidate SQL files `supabase/rebuild-v2/001_schema.sql` through `023_admin_role_grants.sql` on PR #73 head `9e8f0223b1c1760f229c8fb7f791e8c3ee8fc854`.

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

### 2. Support ticket event history is incomplete

- `create_support_ticket_impl` writes one `support_ticket_events` row with event type `created`.
- `send_support_message_impl` inserts a message and updates the ticket timestamp, but does not write a ticket event.
- The event table currently supports `created`, `status_changed`, and `priority_changed`, yet the reviewed candidate SQL contains no producer for the latter two event types and no trusted ticket status/priority transition RPC.
- The Support queue (PR #66) remains read-only; this is consistent with the absence of an audited staff action workflow.

**Recommended next phase:** implement narrow Support/Admin RPCs for assignment, status and priority transitions. Each transition should lock the ticket, validate the actor and allowed state transition, record old/new values and actor in `support_ticket_events`, and write an `audit_events` entry for staff actions with a required reason where appropriate. Add tests for Support scope, Admin override, unauthorized ticket access, invalid transitions, and append-only history. Message events should record metadata only, never duplicate message bodies into audit logs.

### 3. Payments and refunds are schema-only for now

- Candidate SQL defines `payments` and `refunds` with useful trace fields, but no create/verify/approve/process RPC or trusted provider callback handler was found in candidate SQL 001–023.
- PR #61 deliberately provides a read-only view. The page must not imply that a payment can be verified or a refund can be approved/processed.
- Refund status values and `approved_by` columns do not, by themselves, constitute an operational refund workflow.

**Recommended next phase:** first document the payment provider, webhook authenticity model, idempotency rules, reconciliation policy, and legal/business refund policy. Only then design service-only payment state transitions and a separately authorized refund decision/processing flow. Wallet credits for refunds must be a distinct, idempotent ledger operation with an explicit reference to the refund. Do not add placeholder buttons or simulate successful provider actions.

## Implementation order

1. Keep the current financial page read-only and preserve all trace fields.
2. Complete Support ticket transition RPCs and event contracts.
3. Define fraud signal ingestion and Admin review lifecycle contracts.
4. Validate provider and refund policy before designing payment/refund mutations.
5. Run isolated local SQL replay and all relevant contracts against the exact candidate SHA before considering any deployment or cutover.

## Safety boundary

This is a candidate-only audit record. No hosted database was queried or modified for this review. No Production migration, data deletion, Edge deployment, secret update, scheduled job, Vercel Preview, or PR merge was performed.
