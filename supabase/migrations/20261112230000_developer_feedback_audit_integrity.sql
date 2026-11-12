-- Make review status and priority audit events database-authored, not client-authored.
begin;

-- Timestamps are server-owned. Clients may change the business fields but must
-- not be able to forge updated_at or resolved_at values.
create or replace function public.set_developer_feedback_review_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    if new.status = 'resolved' then
      new.resolved_at := now();
    else
      new.resolved_at := null;
    end if;
  elsif old.status is distinct from new.status then
    if new.status = 'resolved' then
      new.resolved_at := now();
    else
      new.resolved_at := null;
    end if;
  else
    new.resolved_at := old.resolved_at;
  end if;

  return new;
end;
$$;

revoke all on function public.set_developer_feedback_review_timestamps()
  from public, anon, authenticated;

drop trigger if exists developer_feedback_review_timestamps
  on public.developer_feedback_reviews;
create trigger developer_feedback_review_timestamps
before insert or update on public.developer_feedback_reviews
for each row
execute function public.set_developer_feedback_review_timestamps();

revoke update (updated_at, resolved_at)
  on public.developer_feedback_reviews from authenticated;

-- Replace the table-level INSERT grant with the exact client-writable fields.
revoke insert on public.developer_feedback_reviews from authenticated;
grant insert (feedback_id, developer_id, status, resolution_note, priority)
  on public.developer_feedback_reviews to authenticated;

create or replace function public.log_developer_feedback_review_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'new' then
      insert into public.developer_feedback_events
        (feedback_id, actor_id, event_type, old_value, new_value)
      values
        (new.feedback_id, (select auth.uid()), 'status_changed', null, new.status);
    end if;

    if new.priority <> 'normal' then
      insert into public.developer_feedback_events
        (feedback_id, actor_id, event_type, old_value, new_value)
      values
        (new.feedback_id, (select auth.uid()), 'priority_changed', null, new.priority);
    end if;

    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.developer_feedback_events
      (feedback_id, actor_id, event_type, old_value, new_value)
    values
      (new.feedback_id, (select auth.uid()), 'status_changed', old.status, new.status);
  end if;

  if old.priority is distinct from new.priority then
    insert into public.developer_feedback_events
      (feedback_id, actor_id, event_type, old_value, new_value)
    values
      (new.feedback_id, (select auth.uid()), 'priority_changed', old.priority, new.priority);
  end if;

  return new;
end;
$$;

revoke all on function public.log_developer_feedback_review_changes()
  from public, anon, authenticated;

drop trigger if exists developer_feedback_review_audit_insert
  on public.developer_feedback_reviews;
drop trigger if exists developer_feedback_review_audit_update
  on public.developer_feedback_reviews;
create trigger developer_feedback_review_audit_insert
after insert on public.developer_feedback_reviews
for each row
execute function public.log_developer_feedback_review_changes();

create trigger developer_feedback_review_audit_update
after update of status, priority on public.developer_feedback_reviews
for each row
execute function public.log_developer_feedback_review_changes();

drop policy if exists developer_feedback_events_insert_participants
  on public.developer_feedback_events;
create policy developer_feedback_events_insert_participants
on public.developer_feedback_events for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and (
    (
      event_type = 'message_sent'
      and exists (
        select 1 from public.developer_feedback_messages m
        where m.feedback_id = developer_feedback_events.feedback_id
          and m.sender_id = (select auth.uid())
          and m.id::text = developer_feedback_events.old_value
      )
    )
    or
    (
      event_type = 'attachment_added'
      and exists (
        select 1 from public.developer_feedback_attachments a
        where a.feedback_id = developer_feedback_events.feedback_id
          and a.uploaded_by = (select auth.uid())
          and a.original_filename = developer_feedback_events.new_value
      )
    )
  )
);

commit;
