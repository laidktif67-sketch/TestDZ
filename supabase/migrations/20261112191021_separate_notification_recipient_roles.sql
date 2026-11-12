-- Separate tester and developer notification feeds without duplicating the table.
alter table public.notifications
  add column if not exists recipient_role text;

-- Preserve historical notifications. Legacy notifications belong to the tester feed,
-- except users who only hold the developer role.
update public.notifications n
set recipient_role = case
  when exists (
    select 1 from public.user_roles ur
    where ur.user_id = n.user_id and ur.role = 'developer'
  ) and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = n.user_id and ur.role = 'tester'
  ) then 'developer'
  else 'tester'
end
where n.recipient_role is null;

alter table public.notifications
  alter column recipient_role set not null;

alter table public.notifications
  add constraint notifications_recipient_role_check
  check (recipient_role in ('tester', 'developer'));


-- A private, non-client-writable role lookup used by RLS.
create or replace function private.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = p_role
  );
$$;

revoke all on function private.has_role(text) from public, anon;
grant execute on function private.has_role(text) to authenticated;

drop policy if exists notifications_select_owner on public.notifications;
drop policy if exists notifications_update_read_at on public.notifications;

create policy notifications_select_owner on public.notifications
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and (
      (recipient_role = 'tester' and (select private.has_role('tester')))
      or
      (recipient_role = 'developer' and (
        (select private.has_role('developer'))
        or (select private.has_role('admin'))
      ))
    )
  );

create policy notifications_update_read_at on public.notifications
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and (
      (recipient_role = 'tester' and (select private.has_role('tester')))
      or
      (recipient_role = 'developer' and (
        (select private.has_role('developer'))
        or (select private.has_role('admin'))
      ))
    )
  )
  with check (
    user_id = (select auth.uid())
    and (
      (recipient_role = 'tester' and (select private.has_role('tester')))
      or
      (recipient_role = 'developer' and (
        (select private.has_role('developer'))
        or (select private.has_role('admin'))
      ))
    )
  );

-- Allow owners to update only read/archive state; recipient_role remains immutable to clients.
grant update (read_at, archived_at) on public.notifications to authenticated;
