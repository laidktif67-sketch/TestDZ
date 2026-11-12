-- Cover the remaining unindexed foreign keys identified by Supabase's database linter.
-- The developer_feedback_attachments(message_id) index is created by
-- 20261112220000_developer_feedback_conversations.sql.
begin;

create index if not exists developer_feedback_attachments_uploaded_by_idx
  on public.developer_feedback_attachments (uploaded_by);

create index if not exists developer_feedback_events_actor_id_idx
  on public.developer_feedback_events (actor_id);

create index if not exists developer_feedback_messages_sender_id_idx
  on public.developer_feedback_messages (sender_id);

-- The FK is composite (ticket_id, message_id); a message_id-only index
-- does not cover its leading-column order.
create index if not exists support_ticket_attachments_ticket_message_idx
  on public.support_ticket_attachments (ticket_id, message_id);

create index if not exists support_ticket_attachments_uploaded_by_idx
  on public.support_ticket_attachments (uploaded_by);

create index if not exists support_ticket_events_actor_id_idx
  on public.support_ticket_events (actor_id);

create index if not exists support_ticket_messages_sender_id_idx
  on public.support_ticket_messages (sender_id);

create index if not exists support_tickets_resolved_by_idx
  on public.support_tickets (resolved_by);

commit;
