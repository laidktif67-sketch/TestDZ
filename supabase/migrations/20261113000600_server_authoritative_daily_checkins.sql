-- Server-authoritative daily check-ins for tester assignments.
-- The date is derived only from the database clock in Africa/Algiers.
begin;

drop policy if exists checkins_insert_tester on public.checkins;
revoke insert on public.checkins from public, anon, authenticated;
grant select on public.checkins to authenticated;

create or replace function public.submit_assignment_checkin(
  p_assignment_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_user_id uuid := auth.uid();
  v_assignment_tester uuid;
  v_assignment_status text;
  v_checkin_date date;
  v_checkin_id uuid;
  v_existing_id uuid;
  v_note text := nullif(pg_catalog.btrim(p_note), '');
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_assignment_id is null then
    raise exception 'ASSIGNMENT_REQUIRED' using errcode = '22023';
  end if;
  if p_note is not null and pg_catalog.char_length(p_note) > 4000 then
    raise exception 'CHECKIN_NOTE_TOO_LONG' using errcode = '22023';
  end if;

  -- Serialize submissions for this assignment to make duplicate detection
  -- and the one-reward-only guarantee race-safe.
  select a.tester_id, a.status
    into v_assignment_tester, v_assignment_status
  from public.assignments a
  where a.id = p_assignment_id
  for update;

  if not found or v_assignment_tester <> v_user_id then
    raise exception 'ASSIGNMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_assignment_status <> 'active' then
    raise exception 'ASSIGNMENT_NOT_ACTIVE' using errcode = '42501';
  end if;

  v_checkin_date := (pg_catalog.clock_timestamp() at time zone 'Africa/Algiers')::date;

  select c.id into v_existing_id
  from public.checkins c
  where c.assignment_id = p_assignment_id
    and c.checkin_date = v_checkin_date;

  if v_existing_id is not null then
    raise exception 'CHECKIN_ALREADY_RECORDED' using errcode = '23505';
  end if;

  insert into public.checkins (assignment_id, tester_id, checkin_date, note)
  values (p_assignment_id, v_user_id, v_checkin_date, v_note)
  returning id into v_checkin_id;

  -- The ledger key is tied to the inserted check-in, and the assignment row
  -- lock plus unique check-in constraint prevent a second daily reward.
  insert into public.points_ledger (
    user_id, wallet_type, amount, reason, reference_type, reference_id, idempotency_key
  ) values (
    v_user_id, 'earned_points', 2, 'Daily assignment check-in',
    'checkin', v_checkin_id, 'checkin:' || v_checkin_id::text
  );

  insert into public.wallets (user_id, earned_points, purchased_credits)
  values (v_user_id, 2, 0)
  on conflict (user_id) do update
    set earned_points = public.wallets.earned_points + 2,
        updated_at = pg_catalog.now();

  return pg_catalog.jsonb_build_object(
    'checkin_id', v_checkin_id,
    'checkin_date', v_checkin_date,
    'points_awarded', 2
  );
end;
$function$;

revoke all on function public.submit_assignment_checkin(uuid, text) from public, anon;
grant execute on function public.submit_assignment_checkin(uuid, text) to authenticated;

commit;
