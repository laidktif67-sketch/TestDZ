-- Enforce account suspension at the database boundary.
-- A banned user may read only their own profile to receive the suspension notice.
begin;

create or replace function private.is_current_user_banned()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $function$
  select coalesce(
    (
      select p.is_banned
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$function$;

revoke all on function private.is_current_user_banned() from public, anon;
grant execute on function private.is_current_user_banned() to authenticated;

-- Restrictive policies are ANDed with every existing permissive policy. They
-- therefore preserve the existing ownership/role rules while denying banned
-- sessions access to other public tables.
do $migration$
declare
  v_table record;
  v_policy text;
  v_trigger text;
begin
  for v_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname <> 'profiles'
  loop
    v_policy := 'account_not_banned';
    execute format(
      'drop policy if exists %I on public.%I',
      v_policy, v_table.relname
    );
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (not (select private.is_current_user_banned())) with check (not (select private.is_current_user_banned()))',
      v_policy, v_table.relname
    );

    v_trigger := 'reject_banned_account_writes';
    execute format(
      'drop trigger if exists %I on public.%I',
      v_trigger, v_table.relname
    );
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function private.reject_banned_account_write()',
      v_trigger, v_table.relname
    );
  end loop;

  -- A suspended user can still read their own profile row (and is_banned),
  -- but cannot change it or read other users' profiles.
  drop policy if exists account_not_banned on public.profiles;
  create policy account_not_banned on public.profiles
    as restrictive for all to authenticated
    using (
      not (select private.is_current_user_banned())
      or id = (select auth.uid())
    )
    with check (not (select private.is_current_user_banned()));

  drop trigger if exists reject_banned_account_writes on public.profiles;
  create trigger reject_banned_account_writes
    before insert or update or delete on public.profiles
    for each row execute function private.reject_banned_account_write();
end;
$migration$;

create or replace function private.reject_banned_account_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select private.is_current_user_banned()) then
    raise exception 'ACCOUNT_SUSPENDED'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

revoke all on function private.reject_banned_account_write()
  from public, anon, authenticated;

-- Storage is outside the public schema and needs its own restrictive policy.
drop policy if exists account_not_banned on storage.objects;
create policy account_not_banned on storage.objects
  as restrictive for all to authenticated
  using (not (select private.is_current_user_banned()))
  with check (not (select private.is_current_user_banned()));

commit;
