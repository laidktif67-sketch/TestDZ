-- Prevent clients from misclassifying support tickets across workspaces.
begin;

drop policy if exists support_tickets_insert_owner on public.support_tickets;
create policy support_tickets_insert_owner on public.support_tickets
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'open'
  and (
    (
      requester_role = 'developer'
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = (select auth.uid())
          and ur.role in ('developer', 'admin')
      )
    )
    or
    (
      requester_role = 'tester'
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = (select auth.uid())
          and ur.role in ('tester', 'admin')
      )
    )
  )
);

commit;
