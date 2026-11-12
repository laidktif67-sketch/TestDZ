begin;

select plan(19);

select ok(
  to_regclass('public.developer_feedback_messages') is not null
  and to_regclass('public.developer_feedback_attachments') is not null
  and to_regclass('public.developer_feedback_events') is not null,
  'developer feedback conversation tables exist'
);

select ok(
  (
    select count(*) = 3
    from pg_class
    where oid in (
      'public.developer_feedback_messages'::regclass,
      'public.developer_feedback_attachments'::regclass,
      'public.developer_feedback_events'::regclass
    )
      and relrowsecurity
  ),
  'all developer feedback conversation tables enforce row-level security'
);

select ok(
  exists (
    select 1 from storage.buckets
    where id = 'developer-feedback-attachments'
      and public = false
      and file_size_limit = 10485760
  ),
  'feedback attachments are stored in a private bucket with a 10 MB limit'
);

select ok(
  has_table_privilege('authenticated', 'public.developer_feedback_messages', 'SELECT')
  and has_table_privilege('authenticated', 'public.developer_feedback_messages', 'INSERT')
  and not has_table_privilege('anon', 'public.developer_feedback_messages', 'SELECT'),
  'messages are exposed only to authenticated sessions with explicit grants'
);

select ok(
  (
    select count(*) = 6
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'developer_feedback_messages',
        'developer_feedback_attachments',
        'developer_feedback_events'
      )
  ),
  'each conversation table has participant-scoped select and insert policies'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.developer_feedback_attachments'::regclass
      and conname = 'developer_feedback_attachments_message_fk'
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%(feedback_id, message_id)%'
  ),
  'attachment metadata is tied to a message belonging to the same feedback'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.developer_feedback_messages'::regclass
      and conname = 'developer_feedback_messages_feedback_id_id_key'
      and contype = 'u'
  ),
  'feedback messages expose the composite key required by attachment integrity'
);

select ok(
  (select attnotnull
   from pg_attribute
   where attrelid = 'public.developer_feedback_attachments'::regclass
     and attname = 'message_id'
     and not attisdropped),
  'every feedback attachment must reference a conversation message'
);

select ok(
  not exists (
    select 1 from pg_constraint
    where conrelid = 'public.developer_feedback_attachments'::regclass
      and conname in (
        'developer_feedback_attachments_feedback_id_fkey',
        'developer_feedback_attachments_message_id_fkey'
      )
  ),
  'legacy independent attachment foreign keys are replaced by the composite foreign key'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.developer_feedback_events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status_changed%'
      and pg_get_constraintdef(oid) like '%attachment_added%'
  ),
  'activity events accept only the supported feedback event types'
);

select ok(
  has_column_privilege('authenticated', 'public.developer_feedback_reviews', 'priority', 'UPDATE'),
  'authenticated developers can update feedback priority'
);

select ok(
  not has_column_privilege('authenticated', 'public.developer_feedback_reviews', 'feedback_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.developer_feedback_reviews', 'developer_id', 'UPDATE'),
  'feedback ownership and developer identity remain immutable to clients'
);

select ok(
  not has_column_privilege('authenticated', 'public.developer_feedback_reviews', 'updated_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.developer_feedback_reviews', 'resolved_at', 'UPDATE'),
  'clients cannot forge feedback review update or resolution timestamps'
);

select ok(
  not has_column_privilege('authenticated', 'public.developer_feedback_reviews', 'updated_at', 'INSERT')
  and not has_column_privilege('authenticated', 'public.developer_feedback_reviews', 'resolved_at', 'INSERT'),
  'clients cannot supply feedback review timestamps during insert'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.developer_feedback_reviews'::regclass
      and tgname = 'developer_feedback_review_timestamps'
      and not tgisinternal
      and (tgtype & 2) = 2
      and (tgtype & 4) = 4
      and (tgtype & 16) = 16
  ),
  'database trigger owns review updated_at and resolved_at timestamps'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.developer_feedback_reviews'::regclass
      and tgname = 'developer_feedback_review_audit_update'
      and not tgisinternal
      and (tgtype & 16) = 16
  ),
  'review status and priority changes are audited by a database trigger'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.developer_feedback_reviews'::regclass
      and tgname = 'developer_feedback_review_audit_insert'
      and not tgisinternal
      and (tgtype & 4) = 4
  ),
  'initial non-default review status and priority are audited on insert'
);

select ok(
  has_table_privilege('authenticated', 'public.developer_feedback_events', 'SELECT')
  and not has_table_privilege('authenticated', 'public.developer_feedback_events', 'INSERT')
  and not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'developer_feedback_events'
      and cmd = 'INSERT'
  ),
  'clients can read the audit trail but cannot insert audit events directly'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.developer_feedback_messages'::regclass
      and tgname = 'developer_feedback_message_audit_insert'
      and not tgisinternal
      and (tgtype & 4) = 4
  ) and exists (
    select 1 from pg_trigger
    where tgrelid = 'public.developer_feedback_attachments'::regclass
      and tgname = 'developer_feedback_attachment_audit_insert'
      and not tgisinternal
      and (tgtype & 4) = 4
  ),
  'message and attachment activity is written automatically by database triggers'
);

select * from finish();

rollback;
