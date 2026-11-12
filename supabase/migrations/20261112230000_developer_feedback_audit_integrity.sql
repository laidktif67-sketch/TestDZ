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

-- Conversation activity is recorded transactionally by database triggers.
-- Clients may read the audit trail, but cannot manufacture audit rows.
create or replace function public.log_developer_feedback_message_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  insert into public.developer_feedback_events
    (feedback_id, actor_id, event_type, old_value)
  values
    (new.feedback_id, new.sender_id, 'message_sent', new.id::text);
  return new;
end;
$;

create or replace function public.log_developer_feedback_attachment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $
begin
  insert into public.developer_feedback_events
    (feedback_id, actor_id, event_type, new_value)
  values
    (new.feedback_id, new.uploaded_by, 'attachment_added', new.original_filename);
  return new;
end;
$;

revoke all on function public.log_developer_feedback_message_event()
  from public, anon, authenticated;
revoke all on function public.log_developer_feedback_attachment_event()
  from public, anon, authenticated;

drop trigger if exists developer_feedback_message_audit_insert
  on public.developer_feedback_messages;
create trigger developer_feedback_message_audit_insert
after insert on public.developer_feedback_messages
for each row
execute function public.log_developer_feedback_message_event();

drop trigger if exists developer_feedback_attachment_audit_insert
  on public.developer_feedback_attachments;
create trigger developer_feedback_attachment_audit_insert
after insert on public.developer_feedback_attachments
for each row
execute function public.log_developer_feedback_attachment_event();

drop policy if exists developer_feedback_events_insert_participants
  on public.developer_feedback_events;
revoke insert on public.developer_feedback_events from authenticated;

commit;
