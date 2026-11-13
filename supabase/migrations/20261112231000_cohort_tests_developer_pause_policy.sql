-- Allow campaign owners to pause or resume recruitment without exposing other cohort fields.
-- A pause must survive cohort status transitions, and terminal cohorts cannot be resumed.
begin;

create or replace function private.cohorts_sync_is_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('completed', 'cancelled') then
    update public.cohort_tests
    set is_active = false
    where cohort_id = new.id;
  end if;
  return new;
end;
$$;

create or replace function private.cohort_tests_validate_is_active_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cohort_status text;
begin
  if new.is_active is not distinct from old.is_active then
    return new;
  end if;

  select c.status
    into v_cohort_status
  from public.cohorts c
  where c.id = new.cohort_id;

  if v_cohort_status is null then
    raise exception 'COHORT_NOT_FOUND';
  end if;

  if new.is_active and v_cohort_status in ('completed', 'cancelled') then
    raise exception 'COHORT_NOT_ACTIVE: cannot resume a test when cohort status is %',
      v_cohort_status;
  end if;

  return new;
end;
$$;

revoke all on function private.cohort_tests_validate_is_active_update()
  from public, anon, authenticated;

drop trigger if exists trg_cohort_tests_validate_is_active_update
  on public.cohort_tests;
create trigger trg_cohort_tests_validate_is_active_update
before update of is_active on public.cohort_tests
for each row
execute function private.cohort_tests_validate_is_active_update();

grant update (is_active) on public.cohort_tests to authenticated;

drop policy if exists cohort_tests_update_developer_recruitment on public.cohort_tests;
create policy cohort_tests_update_developer_recruitment
  on public.cohort_tests
  for update
  to authenticated
  using (
    developer_id = (select auth.uid())
    or (select private.is_admin())
  )
  with check (
    developer_id = (select auth.uid())
    or (select private.is_admin())
  );

commit;
