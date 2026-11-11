-- Medical exception approval audit + tester notification.
-- The request table and base reviewer RPC already exist in the live schema.
-- This migration hardens the approval transaction and records every decision.

begin;

create index if not exists medical_exception_requests_status_created_idx
  on public.medical_exception_requests (status, created_at desc);

create index if not exists medical_exception_requests_assignment_status_idx
  on public.medical_exception_requests (assignment_id, status);

create or replace function private.review_medical_exception(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
)
returns public.medical_exception_requests
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_request public.medical_exception_requests%rowtype;
  v_assignment public.assignments%rowtype;
  v_before jsonb;
  v_extension_before integer;
  v_extension_after integer;
  v_action text;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_DECISION';
  end if;

  if p_review_note is not null and char_length(p_review_note) > 2000 then
    raise exception 'REVIEW_NOTE_TOO_LONG';
  end if;

  select *
    into v_request
  from public.medical_exception_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'MEDICAL_EXCEPTION_NOT_FOUND';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'MEDICAL_EXCEPTION_ALREADY_REVIEWED';
  end if;

  select *
    into v_assignment
  from public.assignments
  where id = v_request.assignment_id
  for update;

  if not found or v_assignment.tester_id <> v_request.tester_id then
    raise exception 'ASSIGNMENT_MISMATCH';
  end if;

  if p_decision = 'approved' then
    if v_assignment.status <> 'active' or v_assignment.start_date is null then
      raise exception 'ASSIGNMENT_NOT_ACTIVE';
    end if;

    if cardinality(v_request.requested_dates) <>
       (select count(distinct d) from unnest(v_request.requested_dates) as d) then
      raise exception 'DUPLICATE_EXCUSED_DATES';
    end if;

    if exists (
      select 1
      from unnest(v_request.requested_dates) as requested_dates(requested_date)
      where requested_date < v_assignment.start_date
         or requested_date > (now() at time zone 'UTC')::date
    ) then
      raise exception 'EXCUSED_DATE_OUTSIDE_ACTIVE_PERIOD';
    end if;

    if exists (
      select 1
      from public.checkins c
      where c.assignment_id = v_request.assignment_id
        and c.checkin_date = any(v_request.requested_dates)
    ) then
      raise exception 'CHECKIN_ALREADY_EXISTS_FOR_EXCUSED_DATE';
    end if;

    if exists (
      select 1
      from public.medical_exception_requests other_request
      cross join lateral unnest(other_request.requested_dates) as approved_dates(approved_date)
      where other_request.assignment_id = v_request.assignment_id
        and other_request.id <> v_request.id
        and other_request.status = 'approved'
        and approved_date = any(v_request.requested_dates)
    ) then
      raise exception 'DATE_ALREADY_EXCUSED';
    end if;
  end if;

  v_before := to_jsonb(v_request);
  v_extension_before := v_assignment.medical_extension_days;

  update public.medical_exception_requests
  set status = p_decision,
      review_note = nullif(btrim(p_review_note), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id
  returning * into v_request;

  v_extension_after := v_extension_before;

  if p_decision = 'approved' then
    v_extension_after := v_extension_before + cardinality(v_request.requested_dates);

    update public.assignments
    set medical_extension_days = v_extension_after,
        medical_exception_note = concat_ws(
          E'\n',
          nullif(medical_exception_note, ''),
          'Approved medical exception request ' || v_request.id::text
            || ': ' || array_to_string(v_request.requested_dates, ', ')
        ),
        medical_exception_approved_by = auth.uid(),
        medical_exception_approved_at = now(),
        updated_at = now()
    where id = v_request.assignment_id;
  end if;

  v_action := case
    when p_decision = 'approved' then 'medical_exception.approved'
    else 'medical_exception.rejected'
  end;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    auth.uid(),
    v_action,
    'medical_exception_request',
    v_request.id,
    v_before,
    to_jsonb(v_request),
    jsonb_build_object(
      'assignment_id', v_request.assignment_id,
      'tester_id', v_request.tester_id,
      'requested_dates', to_jsonb(v_request.requested_dates),
      'extension_days_before', v_extension_before,
      'extension_days_after', v_extension_after,
      'review_note', v_request.review_note
    )
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_request.tester_id,
    case when p_decision = 'approved'
      then 'medical_exception_approved'
      else 'medical_exception_rejected'
    end,
    case when p_decision = 'approved'
      then 'Medical exception approved'
      else 'Medical exception request reviewed'
    end,
    case when p_decision = 'approved'
      then cardinality(v_request.requested_dates)::text
        || ' day(s) were excused and your assignment was extended.'
      else 'Your medical exception request was not approved.'
    end,
    jsonb_build_object(
      'request_id', v_request.id,
      'assignment_id', v_request.assignment_id,
      'status', v_request.status,
      'requested_dates', to_jsonb(v_request.requested_dates),
      'extension_days', case when p_decision = 'approved'
        then cardinality(v_request.requested_dates) else 0 end
    )
  );

  return v_request;
end;
$function$;

revoke all on function private.review_medical_exception(uuid, text, text) from public, anon;
grant execute on function private.review_medical_exception(uuid, text, text) to authenticated;

create or replace function public.review_medical_exception(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
)
returns public.medical_exception_requests
language sql
set search_path = pg_catalog, public
as $function$
  select private.review_medical_exception(p_request_id, p_decision, p_review_note);
$function$;

revoke all on function public.review_medical_exception(uuid, text, text) from public, anon;
grant execute on function public.review_medical_exception(uuid, text, text) to authenticated;

commit;
