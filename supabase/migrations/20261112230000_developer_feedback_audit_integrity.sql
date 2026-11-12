-- Make review status and priority audit events database-authored, not client-authored.
begin;

create or replace function public.log_developer_feedback_review_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

revoke all on function public.log_developer_feedback_review_changes() from public, anon, authenticated;

drop trigger if exists developer_feedback_review_audit_update
  on public.developer_feedback_reviews;
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
