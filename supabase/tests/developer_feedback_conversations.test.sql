begin;

select plan(9);

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
  has_column_privilege('authenticated', 'public.developer_feedback_reviews', 'priority', 'UPDATE'),
  'authenticated developers can update feedback priority'
);

select * from finish();

rollback;
