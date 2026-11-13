-- Forward-only support-ticket priority audit change.
-- Keep this migration narrowly scoped: later migrations already own requester-role
-- policies, table grants, attachment isolation, and support-ticket schema.
begin;

alter table public.support_ticket_events
  add column if not exists old_priority text,
  add column if not exists new_priority text;

alter table public.support_ticket_events
  drop constraint if exists support_ticket_events_event_type_check;

alter table public.support_ticket_events
  add constraint support_ticket_events_event_type_check
  check (event_type in ('created', 'status_changed', 'priority_changed'));

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
    elsif new.status in ('open', 'in_progress', 'waiting_for_user') then
      new.resolved_at := null;
      new.resolved_by := null;
    end if;

    insert into public.support_ticket_events(
      ticket_id, actor_id, event_type, old_status, new_status
    )
    values (
      new.id, (select auth.uid()), 'status_changed', old.status, new.status
    );
  end if;

  if new.priority is distinct from old.priority then
    if not (select private.is_support_staff()) then
      raise exception 'Only authorized support staff can change ticket priority'
        using errcode = '42501';
    end if;

    new.updated_at := now();
    insert into public.support_ticket_events(
      ticket_id, actor_id, event_type, old_priority, new_priority
    )
    values (
      new.id, (select auth.uid()), 'priority_changed', old.priority, new.priority
    );
  end if;

  return new;
end;
$function$;

revoke all on function private.audit_support_ticket_changes()
  from public, anon, authenticated;

drop trigger if exists support_tickets_audit_status_update
  on public.support_tickets;

create trigger support_tickets_audit_status_update
before update of status, priority on public.support_tickets
for each row execute function private.audit_support_ticket_changes();

commit;
