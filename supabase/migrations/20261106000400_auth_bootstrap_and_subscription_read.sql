-- TestDZ / 004_auth_bootstrap_and_subscription_read
-- Auth user creation is server-triggered. Client cannot self-assign roles or create wallets.

begin;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name','')), '');
  if v_display_name is null then
    v_display_name := split_part(coalesce(new.email,''),'@',1);
  end if;

  insert into public.profiles(id,display_name,locale)
  values(new.id,v_display_name,'fr-DZ')
  on conflict (id) do nothing;

  insert into public.user_roles(user_id,role)
  values(new.id,'tester')
  on conflict (user_id,role) do nothing;

  insert into public.wallets(user_id)
  values(new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public,anon,authenticated;

drop trigger if exists on_auth_user_created_testdz on auth.users;
create trigger on_auth_user_created_testdz
after insert on auth.users
for each row execute function private.handle_new_auth_user();

grant select on public.user_roles to authenticated;
create policy user_roles_select_self_or_admin on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- No user_id argument: the caller can only read their own subscription.
create or replace function public.get_active_subscription()
returns table (
  plan_code text,
  features jsonb,
  limits jsonb,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.code,p.features,p.limits,s.current_period_end
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = (select auth.uid())
    and s.status in ('active','trialing')
    and s.current_period_end > now()
  order by s.current_period_end desc
  limit 1;
$$;

revoke all on function public.get_active_subscription() from public,anon;
grant execute on function public.get_active_subscription() to authenticated;

commit;
