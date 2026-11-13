-- Distinguish developer-created support tickets from tester tickets.
-- Safe to apply when the role column and constraint already exist remotely.
begin;

alter table public.support_tickets
  add column if not exists requester_role text;

update public.support_tickets t
set requester_role = case
  when exists (
    select 1 from public.user_roles ur
    where ur.user_id = t.user_id and ur.role = 'developer'
  ) and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = t.user_id and ur.role = 'tester'
  ) then 'developer'
  else 'tester'
end
where t.requester_role is null;

alter table public.support_tickets
  alter column requester_role set default 'tester',
  alter column requester_role set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.support_tickets'::regclass
      and conname = 'support_tickets_requester_role_check'
      and contype = 'c'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_requester_role_check
      check (requester_role in ('tester', 'developer'));
  end if;
end;
$$;

create index if not exists support_tickets_owner_role_created_idx
  on public.support_tickets(user_id, requester_role, created_at desc);

commit;
