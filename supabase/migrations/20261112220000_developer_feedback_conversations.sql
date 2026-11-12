-- Developer feedback conversations, private attachments, and activity history.
-- This migration is intentionally upgrade-safe: the original conversation tables
-- were already created in some linked environments by an earlier migration.
-- Reconcile their shape and policies instead of attempting to recreate them.

begin;

create table if not exists public.developer_feedback_messages (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.developer_feedback_messages'::regclass
      and conname = 'developer_feedback_messages_feedback_id_id_key'
      and contype = 'u'
  ) then
    alter table public.developer_feedback_messages
      add constraint developer_feedback_messages_feedback_id_id_key
      unique (feedback_id, id);
  end if;
end;
$$;

create index if not exists developer_feedback_messages_feedback_created_idx
  on public.developer_feedback_messages(feedback_id, created_at asc);

alter table public.developer_feedback_messages enable row level security;
revoke all on public.developer_feedback_messages from anon, public;
grant select, insert on public.developer_feedback_messages to authenticated;

drop policy if exists developer_feedback_messages_select_participants
  on public.developer_feedback_messages;
drop policy if exists developer_feedback_messages_insert_participants
  on public.developer_feedback_messages;

create policy developer_feedback_messages_select_participants
on public.developer_feedback_messages for select to authenticated
using (exists (
  select 1 from public.feedback f
  where f.id = developer_feedback_messages.feedback_id
    and (f.tester_id = (select auth.uid()) or exists (
      select 1 from public.assignments a join public.tests t on t.id = a.test_id
      where a.id = f.assignment_id and t.developer_id = (select auth.uid())
    ))
));

create policy developer_feedback_messages_insert_participants
on public.developer_feedback_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.feedback f
    where f.id = developer_feedback_messages.feedback_id
      and (f.tester_id = (select auth.uid()) or exists (
        select 1 from public.assignments a join public.tests t on t.id = a.test_id
        where a.id = f.assignment_id and t.developer_id = (select auth.uid())
      ))
  )
);

create table if not exists public.developer_feedback_attachments (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null,
  message_id uuid not null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','text/plain','application/pdf','application/zip')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from public.developer_feedback_attachments
    where message_id is null
  ) then
    raise exception 'Cannot enforce feedback attachment message integrity: existing rows have no message_id';
  end if;
end;
$$;

alter table public.developer_feedback_attachments
  alter column message_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.developer_feedback_attachments'::regclass
      and conname = 'developer_feedback_attachments_storage_path_length_check'
  ) then
    alter table public.developer_feedback_attachments
      add constraint developer_feedback_attachments_storage_path_length_check
      check (char_length(storage_path) between 1 and 1024);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.developer_feedback_attachments'::regclass
      and conname = 'developer_feedback_attachments_message_fk'
      and contype = 'f'
  ) then
    alter table public.developer_feedback_attachments
      drop constraint if exists developer_feedback_attachments_feedback_id_fkey;
    alter table public.developer_feedback_attachments
      drop constraint if exists developer_feedback_attachments_message_id_fkey;
    alter table public.developer_feedback_attachments
      add constraint developer_feedback_attachments_message_fk
      foreign key (feedback_id, message_id)
      references public.developer_feedback_messages(feedback_id, id)
      on delete cascade not valid;
  end if;
end;
$$;

alter table public.developer_feedback_attachments
  validate constraint developer_feedback_attachments_message_fk;

-- An existing (feedback_id, created_at) B-tree index already serves this
-- access path in either scan direction; avoid creating a duplicate.
do $$
begin
  if not exists (
    select 1
    from pg_index i
    where i.indrelid = 'public.developer_feedback_attachments'::regclass
      and i.indisvalid and i.indisready
      and pg_get_indexdef(i.indexrelid) like '%(feedback_id, created_at)%'
  ) then
    create index developer_feedback_attachments_feedback_created_idx
      on public.developer_feedback_attachments(feedback_id, created_at desc);
  end if;
end;
$$;

create index if not exists developer_feedback_attachments_message_idx
  on public.developer_feedback_attachments(message_id);

-- The composite FK replaces the two weaker, independent references.
alter table public.developer_feedback_attachments
  drop constraint if exists developer_feedback_attachments_feedback_id_fkey;
alter table public.developer_feedback_attachments
  drop constraint if exists developer_feedback_attachments_message_id_fkey;

alter table public.developer_feedback_attachments enable row level security;
revoke all on public.developer_feedback_attachments from anon, public;
grant select, insert on public.developer_feedback_attachments to authenticated;

drop policy if exists developer_feedback_attachments_select_participants
  on public.developer_feedback_attachments;
drop policy if exists developer_feedback_attachments_insert_participants
  on public.developer_feedback_attachments;
drop policy if exists developer_feedback_attachments_insert_message_author
  on public.developer_feedback_attachments;

create policy developer_feedback_attachments_select_participants
on public.developer_feedback_attachments for select to authenticated
using (exists (
  select 1 from public.feedback f
  where f.id = developer_feedback_attachments.feedback_id
    and (f.tester_id = (select auth.uid()) or exists (
      select 1 from public.assignments a join public.tests t on t.id = a.test_id
      where a.id = f.assignment_id and t.developer_id = (select auth.uid())
    ))
));

create policy developer_feedback_attachments_insert_message_author
on public.developer_feedback_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and storage_path like feedback_id::text || '/' || (select auth.uid())::text || '/%'
  and exists (
    select 1 from public.developer_feedback_messages m
    where m.id = developer_feedback_attachments.message_id
      and m.feedback_id = developer_feedback_attachments.feedback_id
      and m.sender_id = (select auth.uid())
  )
);

create table if not exists public.developer_feedback_events (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('created','status_changed','priority_changed','message_sent','attachment_added')),
  old_value text check (old_value is null or char_length(old_value) <= 2000),
  new_value text check (new_value is null or char_length(new_value) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists developer_feedback_events_feedback_created_idx
  on public.developer_feedback_events(feedback_id, created_at desc);

alter table public.developer_feedback_events enable row level security;
revoke all on public.developer_feedback_events from anon, public;
grant select, insert on public.developer_feedback_events to authenticated;

drop policy if exists developer_feedback_events_select_owner
  on public.developer_feedback_events;
drop policy if exists developer_feedback_events_select_participants
  on public.developer_feedback_events;
drop policy if exists developer_feedback_events_insert_participants
  on public.developer_feedback_events;

create policy developer_feedback_events_select_participants
on public.developer_feedback_events for select to authenticated
using (exists (
  select 1 from public.feedback f
  where f.id = developer_feedback_events.feedback_id
    and (f.tester_id = (select auth.uid()) or exists (
      select 1 from public.assignments a join public.tests t on t.id = a.test_id
      where a.id = f.assignment_id and t.developer_id = (select auth.uid())
    ))
));

create policy developer_feedback_events_insert_participants
on public.developer_feedback_events for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and exists (
    select 1 from public.feedback f
    where f.id = developer_feedback_events.feedback_id
      and (
        (developer_feedback_events.event_type in ('message_sent','attachment_added')
          and (f.tester_id = (select auth.uid()) or exists (
            select 1 from public.assignments a join public.tests t on t.id = a.test_id
            where a.id = f.assignment_id and t.developer_id = (select auth.uid())
          )))
        or
        (developer_feedback_events.event_type in ('status_changed','priority_changed')
          and exists (
            select 1 from public.assignments a join public.tests t on t.id = a.test_id
            where a.id = f.assignment_id and t.developer_id = (select auth.uid())
          ))
      )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('developer-feedback-attachments','developer-feedback-attachments',false,10485760,
  array['image/png','image/jpeg','image/webp','text/plain','application/pdf','application/zip'])
on conflict (id) do update set
  name = excluded.name, public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists developer_feedback_storage_insert_participants on storage.objects;
drop policy if exists developer_feedback_storage_select_participants on storage.objects;
drop policy if exists developer_feedback_attachments_storage_insert on storage.objects;
drop policy if exists developer_feedback_attachments_storage_select on storage.objects;

create policy developer_feedback_attachments_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'developer-feedback-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.feedback f
    where f.id = case
      when (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then ((storage.foldername(name))[1])::uuid
      else null
    end
    and (f.tester_id = (select auth.uid()) or exists (
      select 1 from public.assignments a join public.tests t on t.id = a.test_id
      where a.id = f.assignment_id and t.developer_id = (select auth.uid())
    ))
  )
);

create policy developer_feedback_attachments_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'developer-feedback-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and exists (
    select 1 from public.feedback f
    where f.id = case
      when (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then ((storage.foldername(name))[1])::uuid
      else null
    end
    and (f.tester_id = (select auth.uid()) or exists (
      select 1 from public.assignments a join public.tests t on t.id = a.test_id
      where a.id = f.assignment_id and t.developer_id = (select auth.uid())
    ))
  )
);

commit;
