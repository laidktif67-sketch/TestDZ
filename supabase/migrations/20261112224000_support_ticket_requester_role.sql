-- Distinguish developer-created support tickets from tester tickets.
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
  alter column requester_role set not null,
  add constraint support_tickets_requester_role_check
    check (requester_role in ('tester', 'developer'));

commit;
