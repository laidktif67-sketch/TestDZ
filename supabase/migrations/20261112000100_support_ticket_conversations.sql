-- TestDZ: support ticket conversations, private attachments, and status audit.
-- Additive migration: does not recreate or overwrite the existing support_tickets table.
begin;

create or replace function private.is_support_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('support', 'admin')
  );
$function$;

revoke all on function private.is_support_staff() from public, anon;
grant execute on function private.is_support_staff() to authenticated;

alter table public.support_tickets
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  constraint support_ticket_messages_ticket_id_id_key unique (ticket_id, id)
);

create index if not exists support_ticket_messages_ticket_created_idx
  on public.support_ticket_messages(ticket_id, created_at asc);

alter table public.support_ticket_messages enable row level security;
revoke all on public.support_ticket_messages from anon, public;
grant select, insert on public.support_ticket_messages to authenticated;

drop policy if exists support_ticket_messages_select_participants on public.support_ticket_messages;
create policy support_ticket_messages_select_participants
on public.support_ticket_messages for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and (t.user_id = (select auth.uid()) or (select private.is_support_staff()))
  )
);

drop policy if exists support_ticket_messages_insert_participants on public.support_ticket_messages;
create policy support_ticket_messages_insert_participants
on public.support_ticket_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and t.status not in ('closed')
      and (t.user_id = (select auth.uid()) or (select private.is_support_staff()))
  )
);

create table if not exists public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  message_id uuid not null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique check (char_length(storage_path) between 1 and 1024),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','text/plain','application/pdf','application/zip')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  constraint support_ticket_attachments_message_fk
    foreign key (ticket_id, message_id)
    references public.support_ticket_messages(ticket_id, id) on delete cascade
);

create index if not exists support_ticket_attachments_message_idx
  on public.support_ticket_attachments(message_id);

alter table public.support_ticket_attachments enable row level security;
revoke all on public.support_ticket_attachments from anon, public;
grant select, insert on public.support_ticket_attachments to authenticated;

drop policy if exists support_ticket_attachments_select_participants on public.support_ticket_attachments;
create policy support_ticket_attachments_select_participants
on public.support_ticket_attachments for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_attachments.ticket_id
      and (t.user_id = (select auth.uid()) or (select private.is_support_staff()))
  )
);

drop policy if exists support_ticket_attachments_insert_message_author on public.support_ticket_attachments;
create policy support_ticket_attachments_insert_message_author
on public.support_ticket_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and storage_path like support_ticket_attachments.ticket_id::text || '/' || (select auth.uid())::text || '/%'
  and exists (
    select 1 from public.support_ticket_messages m
    join public.support_tickets t on t.id = m.ticket_id
    where m.id = support_ticket_attachments.message_id
      and m.ticket_id = support_ticket_attachments.ticket_id
      and m.sender_id = (select auth.uid())
      and (t.user_id = (select auth.uid()) or (select private.is_support_staff()))
  )
);

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('created','status_changed','priority_changed')),
  old_status text,
  new_status text,
  old_priority text,
  new_priority text,
  created_at timestamptz not null default now()
);

alter table public.support_ticket_events
  add column if not exists old_priority text,
  add column if not exists new_priority text;
alter table public.support_ticket_events
  drop constraint if exists support_ticket_events_event_type_check;
alter table public.support_ticket_events
  add constraint support_ticket_events_event_type_check
  check (event_type in ('created','status_changed','priority_changed'));

create index if not exists support_ticket_events_ticket_created_idx
  on public.support_ticket_events(ticket_id, created_at asc);

alter table public.support_ticket_events enable row level security;
revoke all on public.support_ticket_events from anon, public;
grant select on public.support_ticket_events to authenticated;

drop policy if exists support_ticket_events_select_participants on public.support_ticket_events;
create policy support_ticket_events_select_participants
on public.support_ticket_events for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_events.ticket_id
      and (t.user_id = (select auth.uid()) or (select private.is_support_staff()))
  )
);

create or replace function private.audit_support_ticket_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.support_ticket_events(ticket_id, actor_id, event_type, new_status)
    values (new.id, (select auth.uid()), 'created', new.status);
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (select private.is_support_staff()) then
      raise exception 'Only authorized support staff can change ticket status'
        using errcode = '42501';
    end if;

    new.updated_at := now();
    if new.status = 'resolved' then
      new.resolved_at := now();
      new.resolved_by := (select auth.uid());
    elsif new.status in ('open','in_progress','waiting_for_user') then
      new.resolved_at := null;
      new.resolved_by := null;
    end if;

    insert into public.support_ticket_events(ticket_id, actor_id, event_type, old_status, new_status)
    values (new.id, (select auth.uid()), 'status_changed', old.status, new.status);
  end if;

  if new.priority is distinct from old.priority then
    if not (select private.is_support_staff()) then
      raise exception 'Only authorized support staff can change ticket priority'
        using errcode = '42501';
    end if;

    new.updated_at := now();
    insert into public.support_ticket_events(ticket_id, actor_id, event_type, old_priority, new_priority)
    values (new.id, (select auth.uid()), 'priority_changed', old.priority, new.priority);
  end if;

  return new;
end;
$function$;

revoke all on function private.audit_support_ticket_changes() from public, anon, authenticated;

drop trigger if exists support_tickets_audit_insert on public.support_tickets;
create trigger support_tickets_audit_insert
after insert on public.support_tickets
for each row execute function private.audit_support_ticket_changes();

drop trigger if exists support_tickets_audit_status_update on public.support_tickets;
create trigger support_tickets_audit_status_update
before update of status, priority on public.support_tickets
for each row execute function private.audit_support_ticket_changes();

drop policy if exists support_tickets_select_owner_or_admin on public.support_tickets;
create policy support_tickets_select_owner_or_support
on public.support_tickets for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_support_staff()));

drop policy if exists support_tickets_update_support_staff on public.support_tickets;
create policy support_tickets_update_support_staff
on public.support_tickets for update to authenticated
using ((select private.is_support_staff()))
with check ((select private.is_support_staff()));

revoke update on public.support_tickets from authenticated;
grant update (status) on public.support_tickets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760,
  array['image/png','image/jpeg','image/webp','text/plain','application/pdf','application/zip']
)
on conflict (id) do nothing;

drop policy if exists support_attachments_insert_participants on storage.objects;
create policy support_attachments_insert_participants
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.support_tickets t
    where t.id = case
      when (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      and (t.user_id = (select auth.uid()) or (select private.is_support_staff()))
      and t.status <> 'closed'
  )
);

drop policy if exists support_attachments_select_participants on storage.objects;
create policy support_attachments_select_participants
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and exists (
    select 1 from public.support_tickets t
    where t.id = ((storage.foldername(name))[1])::uuid
      and (t.user_id = (select auth.uid()) or (select private.is_support_staff()))
  )
);

commit;

        then ((storage.foldername(name))[1])::uuid
      else null
    end
      and (t.user_id = (select auth.uid()) or (select private.is_support_staff()))
      and t.status <> 'closed'
  )
);

drop policy if exists support_attachments_select_participants on storage.objects;
create policy support_attachments_select_participants
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and exists (
    select 1 from public.support_tickets t
    where t.id = case
      when (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      and (t.user_id = (select auth.uid()) or (select private.is_support_staff()))
  )
);

commit;

        then ((storage.foldername(name))[1])::uuid
      else null
    end
      and (t.user_id = (select auth.uid()) or (select private.is_support_staff()))
  )
);

commit;
