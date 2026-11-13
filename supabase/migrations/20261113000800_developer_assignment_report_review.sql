-- Developer final-report decision, assignment completion and configurable reward.
begin;

create or replace function public.review_assignment_submission(
  p_submission_id uuid,
  p_decision text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_actor uuid := auth.uid();
  v_submission public.assignment_submissions%rowtype;
  v_assignment public.assignments%rowtype;
  v_test_developer uuid;
  v_reward_value jsonb;
  v_reward_points bigint;
  v_ledger_id uuid;
  v_expected_count integer;
  v_actual_count integer;
  v_excused_count integer;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_submission_id is null
    or p_decision not in ('accepted','rejected')
    or p_decision is null then
    raise exception 'INVALID_REVIEW_DECISION' using errcode = '22023';
  end if;
  if p_review_note is not null and char_length(btrim(p_review_note)) > 2000 then
    raise exception 'REVIEW_NOTE_TOO_LONG' using errcode = '22023';
  end if;
  if p_decision = 'rejected'
    and (p_review_note is null or char_length(btrim(p_review_note)) < 10) then
    raise exception 'REJECTION_REASON_REQUIRED' using errcode = '22023';
  end if;

  select * into v_submission
  from public.assignment_submissions
  where id = p_submission_id
  for update;
  if not found then
    raise exception 'SUBMISSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_submission.status <> 'submitted' then
    raise exception 'SUBMISSION_ALREADY_REVIEWED' using errcode = '23514';
  end if;

  select a.* into v_assignment
  from public.assignments a
  where a.id = v_submission.assignment_id
    and a.test_id = v_submission.test_id
    and a.tester_id = v_submission.tester_id
  for update;
  if not found or v_assignment.status <> 'active' then
    raise exception 'ACTIVE_ASSIGNMENT_NOT_FOUND' using errcode = '42501';
  end if;

  select t.developer_id into v_test_developer
  from public.tests t
  where t.id = v_submission.test_id;
  if not found then
    raise exception 'TEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.is_admin()
    and (not private.has_role('developer') or v_test_developer <> v_actor) then
    raise exception 'DEVELOPER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if p_decision = 'accepted' then
    if v_assignment.start_date is null then
      raise exception 'ASSIGNMENT_START_DATE_REQUIRED' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.feedback f
      where f.assignment_id = v_assignment.id
        and f.tester_id = v_assignment.tester_id
    ) then
      raise exception 'ASSIGNMENT_FEEDBACK_REQUIRED' using errcode = '23514';
    end if;

    -- Approved medical-exemption dates extend the calendar but never count
    -- as check-ins. Require exactly 14 check-ins on every non-excused day.
    select count(distinct d)::integer into v_excused_count
    from public.medical_exception_requests r
    cross join lateral unnest(r.requested_dates) as excused(d)
    where r.assignment_id = v_assignment.id
      and r.tester_id = v_assignment.tester_id
      and r.status = 'approved'
      and r.requested_dates is not null;
    if v_excused_count <> v_assignment.medical_extension_days then
      raise exception 'MEDICAL_EXTENSION_DATES_MISMATCH' using errcode = '23514';
    end if;

    with expected_days as (
      select g::date as required_date
      from generate_series(
        v_assignment.start_date::timestamp,
        (v_assignment.start_date + 13 + v_assignment.medical_extension_days)::timestamp,
        interval '1 day'
      ) g
      where not exists (
        select 1
        from public.medical_exception_requests r
        cross join lateral unnest(r.requested_dates) as excused(d)
        where r.assignment_id = v_assignment.id
          and r.status = 'approved'
          and excused.d = g::date
      )
    ),
    actual_days as (
      select c.checkin_date
      from public.checkins c
      where c.assignment_id = v_assignment.id
        and c.tester_id = v_assignment.tester_id
    )
    select
      (select count(*)::integer from expected_days),
      (select count(*)::integer from actual_days),
      (select count(*)::integer from actual_days a
       where not exists (select 1 from expected_days e where e.required_date = a.checkin_date))
    into v_expected_count, v_actual_count, v_excused_count;

    if v_expected_count <> 14 or v_actual_count <> 14 or v_excused_count <> 0 then
      raise exception 'ASSIGNMENT_CHECKINS_INCOMPLETE'
        using errcode = '23514',
        detail = format('Expected 14 required check-ins; required=%s actual=%s invalid=%s',
          v_expected_count, v_actual_count, v_excused_count);
    end if;

    select value into v_reward_value
    from public.platform_config
    where key = 'bonus.assignment_completed'
    for share;
    if v_reward_value is null
      or v_reward_value #>> '{}' !~ '^[0-9]{1,9}$' then
      raise exception 'ASSIGNMENT_REWARD_NOT_CONFIGURED' using errcode = '23514';
    end if;
    v_reward_points := (v_reward_value #>> '{}')::bigint;
    if v_reward_points <= 0 then
      raise exception 'ASSIGNMENT_REWARD_NOT_CONFIGURED' using errcode = '23514';
    end if;

    if exists (
      select 1 from public.points_ledger l
      where l.idempotency_key = 'assignment_completed:' || v_assignment.id::text
    ) then
      raise exception 'ASSIGNMENT_REWARD_ALREADY_GRANTED' using errcode = '23505';
    end if;

    update public.assignments
    set status = 'completed',
        completed_at = now(),
        developer_confirmed_at = now(),
        updated_at = now()
    where id = v_assignment.id;

    insert into public.points_ledger(
      user_id,wallet_type,amount,reason,reference_type,reference_id,idempotency_key
    ) values (
      v_assignment.tester_id,'earned_points',v_reward_points,
      'Assignment completed and developer-approved',
      'assignment',v_assignment.id,'assignment_completed:'||v_assignment.id::text
    ) returning id into v_ledger_id;

    insert into public.wallets(user_id,earned_points,purchased_credits)
    values(v_assignment.tester_id,v_reward_points,0)
    on conflict(user_id) do update
      set earned_points = public.wallets.earned_points + excluded.earned_points,
          updated_at = now();

  else
    update public.assignments
    set status = 'rejected',
        updated_at = now()
    where id = v_assignment.id;
    v_reward_points := 0;
  end if;

  update public.assignment_submissions
  set status = p_decision,
      reviewed_by = v_actor,
      reviewed_at = now(),
      review_note = nullif(btrim(p_review_note),'')
  where id = v_submission.id;

  insert into public.audit_logs(
    actor_id,action,entity_type,entity_id,before_data,after_data,metadata
  ) values (
    v_actor,
    case when p_decision='accepted' then 'assignment.report_accepted' else 'assignment.report_rejected' end,
    'assignment_submission',
    v_submission.id,
    jsonb_build_object('submission_status','submitted','assignment_status','active'),
    jsonb_build_object('submission_status',p_decision,
      'assignment_status',case when p_decision='accepted' then 'completed' else 'rejected' end),
    jsonb_build_object('assignment_id',v_assignment.id,'tester_id',v_assignment.tester_id,
      'review_note',nullif(btrim(p_review_note),''),'points_awarded',v_reward_points,
      'ledger_id',v_ledger_id)
  );

  insert into public.notifications(user_id,recipient_role,type,title,body,data)
  values(
    v_assignment.tester_id,
    'tester',
    case when p_decision='accepted' then 'assignment_report_accepted' else 'assignment_report_rejected' end,
    case when p_decision='accepted' then 'Test report approved' else 'Test report rejected' end,
    case when p_decision='accepted'
      then 'Your final report was approved. Your assignment is complete and earned points have been added to your wallet.'
      else 'Your final report was rejected. Review the developer note and contact support if you believe this is an error.' end,
    jsonb_build_object('submission_id',v_submission.id,'assignment_id',v_assignment.id,
      'decision',p_decision,'points_awarded',v_reward_points,'review_note',nullif(btrim(p_review_note),''))
  );

  return jsonb_build_object(
    'submission_id',v_submission.id,
    'assignment_id',v_assignment.id,
    'status',p_decision,
    'assignment_status',case when p_decision='accepted' then 'completed' else 'rejected' end,
    'points_awarded',v_reward_points,
    'ledger_id',v_ledger_id
  );
end;
$function$;

revoke all on function public.review_assignment_submission(uuid,text,text) from public,anon;
grant execute on function public.review_assignment_submission(uuid,text,text) to authenticated;

commit;
