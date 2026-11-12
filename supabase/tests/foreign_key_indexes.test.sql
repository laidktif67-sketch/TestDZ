begin;

select plan(8);

select ok(
  exists (
    select 1 from pg_index i
    where i.indexrelid = to_regclass('public.developer_feedback_attachments_uploaded_by_idx')
      and i.indisvalid and i.indisready
      and pg_get_indexdef(i.indexrelid) like '%(uploaded_by)%'
  ),
  'developer feedback attachment uploader foreign key is indexed'
);

select ok(
  exists (
    select 1 from pg_index i
    where i.indexrelid = to_regclass('public.developer_feedback_events_actor_id_idx')
      and i.indisvalid and i.indisready
      and pg_get_indexdef(i.indexrelid) like '%(actor_id)%'
  ),
  'developer feedback event actor foreign key is indexed'
);

select ok(
  exists (
    select 1 from pg_index i
    where i.indexrelid = to_regclass('public.developer_feedback_messages_sender_id_idx')
      and i.indisvalid and i.indisready
      and pg_get_indexdef(i.indexrelid) like '%(sender_id)%'
  ),
  'developer feedback message sender foreign key is indexed'
);

select ok(
  exists (
    select 1 from pg_index i
    where i.indexrelid = to_regclass('public.support_ticket_attachments_ticket_message_idx')
      and i.indisvalid and i.indisready
      and pg_get_indexdef(i.indexrelid) like '%(ticket_id, message_id)%'
  ),
  'support attachment composite ticket/message foreign key is indexed in column order'
);

select ok(
  exists (
    select 1 from pg_index i
    where i.indexrelid = to_regclass('public.support_ticket_attachments_uploaded_by_idx')
      and i.indisvalid and i.indisready
      and pg_get_indexdef(i.indexrelid) like '%(uploaded_by)%'
  ),
  'support attachment uploader foreign key is indexed'
);

select ok(
  exists (
    select 1 from pg_index i
    where i.indexrelid = to_regclass('public.support_ticket_events_actor_id_idx')
      and i.indisvalid and i.indisready
      and pg_get_indexdef(i.indexrelid) like '%(actor_id)%'
  ),
  'support ticket event actor foreign key is indexed'
);

select ok(
  exists (
    select 1 from pg_index i
    where i.indexrelid = to_regclass('public.support_ticket_messages_sender_id_idx')
      and i.indisvalid and i.indisready
      and pg_get_indexdef(i.indexrelid) like '%(sender_id)%'
  ),
  'support ticket message sender foreign key is indexed'
);

select ok(
  exists (
    select 1 from pg_index i
    where i.indexrelid = to_regclass('public.support_tickets_resolved_by_idx')
      and i.indisvalid and i.indisready
      and pg_get_indexdef(i.indexrelid) like '%(resolved_by)%'
  ),
  'support ticket resolver foreign key is indexed'
);

select * from finish();

rollback;
