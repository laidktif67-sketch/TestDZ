-- TestDZ / 008_events_admin_read_policy
-- Outbox events are backend-owned. Admins may inspect them; clients cannot mutate them.
begin;

revoke all on table public.events from anon, authenticated;
grant select on table public.events to authenticated;

drop policy if exists events_select_admin on public.events;
create policy events_select_admin on public.events
  for select to authenticated
  using ((select private.is_admin()));

commit;
