-- Cover the two foreign keys still reported unindexed after the staged rebuild.
-- The attachment FK is composite, so its index must start with (feedback_id, message_id).
-- This migration is additive and does not alter data, constraints, or access policies.

begin;

create index if not exists developer_feedback_attachments_feedback_message_idx
  on public.developer_feedback_attachments (feedback_id, message_id);

create index if not exists medical_exception_requests_tester_id_idx
  on public.medical_exception_requests (tester_id);

commit;
