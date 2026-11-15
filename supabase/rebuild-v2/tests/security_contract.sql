-- TestDZ rebuild v2 security contract checks.
-- Run after 001_schema.sql and 002_security.sql in a disposable Supabase test project.
-- The script is read-only apart from a transaction-local test probe; it rolls back.

begin;

do $$
declare
  v_count integer;
  v_policy text;
begin
  select count(*) into v_count
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='rebuild_v2' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity;
  if v_count <> 43 then raise exception 'expected 43 tables with forced RLS, got %',v_count; end if;

  select count(distinct tablename) into v_count
  from pg_policies where schemaname='rebuild_v2';
  if v_count <> 43 then raise exception 'expected policy coverage for all 43 tables, got %',v_count; end if;

  if has_schema_privilege('anon','rebuild_v2','USAGE') then
    raise exception 'anon unexpectedly has candidate schema usage';
  end if;

  if has_table_privilege('authenticated','rebuild_v2.wallets','INSERT')
     or has_table_privilege('authenticated','rebuild_v2.wallets','UPDATE')
     or has_table_privilege('authenticated','rebuild_v2.wallet_ledger','INSERT')
     or has_table_privilege('authenticated','rebuild_v2.user_roles','INSERT') then
    raise exception 'authenticated has an unsafe direct write grant';
  end if;

  if not has_column_privilege('authenticated','rebuild_v2.profiles','display_name','UPDATE')
     or has_column_privilege('authenticated','rebuild_v2.profiles','is_banned','UPDATE')
     or has_column_privilege('authenticated','rebuild_v2.profiles','is_verified','UPDATE') then
    raise exception 'profile column grants are not restricted as designed';
  end if;

  if has_function_privilege('anon','rebuild_v2_private.has_role(uuid,text[])','EXECUTE')
     or has_function_privilege('anon','rebuild_v2_private.grant_role(uuid,text,text)','EXECUTE')
     or has_function_privilege('anon','rebuild_v2_private.post_wallet_entry(uuid,text,bigint,text,text,text,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','rebuild_v2_private.handle_new_auth_user()','EXECUTE') then
    raise exception 'privileged function grants are too broad';
  end if;

  if rebuild_v2_private.has_role(gen_random_uuid(),array['admin']) then
    raise exception 'role helper accepted an unrelated identity';
  end if;

  select qual into v_policy from pg_policies
  where schemaname='rebuild_v2' and tablename='support_ticket_messages'
    and policyname='support_messages_select_ticket_participants_v2';
  if v_policy is null or position('internal_note' in v_policy)=0 then
    raise exception 'support internal-note visibility guard is missing';
  end if;

  if not exists(select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='auth' and c.relname='users'
      and t.tgname='rebuild_v2_on_auth_user_created' and not t.tgisinternal) then
    raise exception 'signup bootstrap trigger is missing';
  end if;

  begin
    perform rebuild_v2_private.grant_role(gen_random_uuid(),'support','unauthenticated test must be rejected');
    raise exception 'grant_role allowed a caller without an admin session';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform rebuild_v2_private.post_wallet_entry(gen_random_uuid(),'earned_points',10,'reward','test-key-0001','unauthenticated test must be rejected');
    raise exception 'post_wallet_entry allowed a caller without a financial session';
  exception when insufficient_privilege then
    null;
  end;
end $$;

create temp table rebuild_v2_immutable_probe(id integer primary key);
create trigger rebuild_v2_immutable_probe_trigger
before update or delete on rebuild_v2_immutable_probe
for each row execute function rebuild_v2_private.prevent_immutable_mutation();
insert into rebuild_v2_immutable_probe values(1);

do $$
begin
  begin
    update rebuild_v2_immutable_probe set id=2 where id=1;
    raise exception 'immutable trigger failed to reject update';
  exception when others then
    if sqlerrm not like 'immutable_record:%' then raise; end if;
  end;
end $$;

rollback;

select 'rebuild_v2_security_contract: PASS' as result;
