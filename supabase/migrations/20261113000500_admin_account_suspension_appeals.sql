-- Controlled administrator suspension and seven-day appeal workflow.
begin;

create table public.account_suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  status text not null default 'active' check (status in ('active', 'lifted')),
  suspended_at timestamptz not null default now(),
  appeal_deadline timestamptz not null,
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null,
  lift_reason text,
  constraint account_suspensions_lift_consistency check (
    (status = 'active' and lifted_at is null and lifted_by is null and lift_reason is null)
    or
    (status = 'lifted' and lifted_at is not null and lifted_by is not null and lift_reason is not null)
  )
);

create unique index account_suspensions_one_active_per_user
  on public.account_suspensions(user_id) where status = 'active';
create index account_suspensions_user_created_idx
  on public.account_suspensions(user_id, suspended_at desc);

create table public.account_suspension_appeals (
  id uuid primary key default gen_random_uuid(),
  suspension_id uuid not null references public.account_suspensions(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  message text not null check (char_length(btrim(message)) between 20 and 5000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  resolution text,
  constraint account_suspension_appeal_review_consistency check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null and resolution is null)
    or
    (status in ('accepted', 'rejected') and reviewed_at is not null
      and reviewed_by is not null and resolution is not null)
  ),
  unique (suspension_id)
);

create index account_suspension_appeals_user_created_idx
  on public.account_suspension_appeals(user_id, submitted_at desc);

alter table public.account_suspensions enable row level security;
alter table public.account_suspension_appeals enable row level security;
revoke all on public.account_suspensions, public.account_suspension_appeals
  from public, anon, authenticated;

-- No direct table access: all operations are mediated by narrowly scoped RPCs.

create or replace function public.admin_suspend_user(
  p_user_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_suspension_id uuid;
  v_before jsonb;
begin
  if v_actor is null or not private.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_actor then
    raise exception 'INVALID_SUSPENSION_TARGET' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'INVALID_SUSPENSION_REASON' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = 'admin'
  ) then
    raise exception 'ADMIN_TARGET_REQUIRES_SEPARATE_REVIEW' using errcode = '42501';
  end if;

  select jsonb_build_object('is_banned', p.is_banned)
    into v_before
  from public.profiles p
  where p.id = p_user_id
  for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if (v_before ->> 'is_banned')::boolean then
    raise exception 'USER_ALREADY_SUSPENDED' using errcode = '23505';
  end if;

  update public.profiles set is_banned = true where id = p_user_id;

  insert into public.account_suspensions (
    user_id, actor_id, reason, appeal_deadline
  ) values (
    p_user_id, v_actor, btrim(p_reason), now() + interval '7 days'
  ) returning id into v_suspension_id;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    v_actor, 'account.suspended', 'profile', p_user_id,
    v_before, jsonb_build_object('is_banned', true),
    jsonb_build_object('suspension_id', v_suspension_id, 'appeal_deadline', now() + interval '7 days')
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    p_user_id, 'account_suspended', 'Account suspended',
    'Your TestDZ account has been suspended. You may submit one appeal within 7 days.',
    jsonb_build_object('suspension_id', v_suspension_id, 'appeal_deadline', now() + interval '7 days')
  );

  return v_suspension_id;
end;
$function$;

create or replace function public.submit_account_suspension_appeal(
  p_suspension_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_appeal_id uuid;
  v_deadline timestamptz;
begin
  if v_user is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 20 and 5000 then
    raise exception 'INVALID_APPEAL_MESSAGE' using errcode = '22023';
  end if;

  select s.appeal_deadline into v_deadline
  from public.account_suspensions s
  where s.id = p_suspension_id
    and s.user_id = v_user
    and s.status = 'active'
  for update;
  if not found then
    raise exception 'ACTIVE_SUSPENSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if now() > v_deadline then
    raise exception 'APPEAL_WINDOW_EXPIRED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = v_user and p.is_banned
  ) then
    raise exception 'ACCOUNT_NOT_SUSPENDED' using errcode = '42501';
  end if;

  insert into public.account_suspension_appeals (suspension_id, user_id, message)
  values (p_suspension_id, v_user, btrim(p_message))
  returning id into v_appeal_id;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, after_data, metadata
  ) values (
    v_user, 'account.suspension_appeal_submitted', 'account_suspension', p_suspension_id,
    jsonb_build_object('appeal_id', v_appeal_id, 'status', 'pending'),
    jsonb_build_object('appeal_deadline', v_deadline)
  );

  -- The submitter is suspended. Do not write to notifications here:
  -- PR27 intentionally blocks all writes by banned identities, including writes
  -- performed inside SECURITY DEFINER functions. The pending appeal itself is
  -- the administrator review queue; admin notifications are emitted on review.
  return v_appeal_id;
end;
$function$;

create or replace function public.admin_review_account_suspension_appeal(
  p_appeal_id uuid,
  p_decision text,
  p_resolution text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_appeal public.account_suspension_appeals%rowtype;
  v_suspension public.account_suspensions%rowtype;
begin
  if v_actor is null or not private.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_decision is null
    or p_decision not in ('accepted', 'rejected')
    or p_resolution is null
    or char_length(btrim(p_resolution)) not between 10 and 2000 then
    raise exception 'INVALID_APPEAL_DECISION' using errcode = '22023';
  end if;

  select * into v_appeal
  from public.account_suspension_appeals
  where id = p_appeal_id
  for update;
  if not found or v_appeal.status <> 'pending' then
    raise exception 'PENDING_APPEAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_suspension
  from public.account_suspensions
  where id = v_appeal.suspension_id
  for update;
  if not found or v_suspension.status <> 'active' then
    raise exception 'ACTIVE_SUSPENSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.account_suspension_appeals
  set status = p_decision, reviewed_at = now(), reviewed_by = v_actor,
      resolution = btrim(p_resolution)
  where id = p_appeal_id;

  if p_decision = 'accepted' then
    update public.profiles set is_banned = false where id = v_appeal.user_id;
    update public.account_suspensions
    set status = 'lifted', lifted_at = now(), lifted_by = v_actor,
        lift_reason = 'Appeal accepted: ' || btrim(p_resolution)
    where id = v_appeal.suspension_id;
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    v_actor, 'account.suspension_appeal_reviewed', 'account_suspension', v_appeal.suspension_id,
    jsonb_build_object('appeal_status', 'pending', 'is_banned', true),
    jsonb_build_object('appeal_status', p_decision, 'is_banned', (p_decision <> 'accepted')),
    jsonb_build_object('appeal_id', p_appeal_id, 'resolution', btrim(p_resolution))
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_appeal.user_id,
    case when p_decision = 'accepted' then 'account_reinstated' else 'account_appeal_rejected' end,
    case when p_decision = 'accepted' then 'Account reinstated' else 'Appeal reviewed' end,
    case when p_decision = 'accepted'
      then 'Your appeal was accepted and your account suspension has been lifted.'
      else 'Your appeal was reviewed and the suspension remains in place.' end,
    jsonb_build_object('appeal_id', p_appeal_id, 'decision', p_decision, 'resolution', btrim(p_resolution))
  );
end;
$function$;

create or replace function public.admin_lift_account_suspension(
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
begin
  if v_actor is null or not private.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_actor
    or p_reason is null
    or char_length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'INVALID_LIFT_REQUEST' using errcode = '22023';
  end if;

  select jsonb_build_object('is_banned', p.is_banned) into v_before
  from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not (v_before ->> 'is_banned')::boolean then
    raise exception 'ACCOUNT_NOT_SUSPENDED' using errcode = '23514';
  end if;

  update public.profiles set is_banned = false where id = p_user_id;
  update public.account_suspensions
  set status = 'lifted', lifted_at = now(), lifted_by = v_actor, lift_reason = btrim(p_reason)
  where user_id = p_user_id and status = 'active';

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    v_actor, 'account.suspension_lifted', 'profile', p_user_id,
    v_before, jsonb_build_object('is_banned', false),
    jsonb_build_object('reason', btrim(p_reason))
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    p_user_id, 'account_reinstated', 'Account reinstated',
    'An administrator has lifted your account suspension.',
    jsonb_build_object('reason', btrim(p_reason))
  );
end;
$function$;

revoke all on function public.admin_suspend_user(uuid, text) from public, anon;
revoke all on function public.submit_account_suspension_appeal(uuid, text) from public, anon;
revoke all on function public.admin_review_account_suspension_appeal(uuid, text, text) from public, anon;
revoke all on function public.admin_lift_account_suspension(uuid, text) from public, anon;
grant execute on function public.admin_suspend_user(uuid, text) to authenticated;
grant execute on function public.submit_account_suspension_appeal(uuid, text) to authenticated;
grant execute on function public.admin_review_account_suspension_appeal(uuid, text, text) to authenticated;
grant execute on function public.admin_lift_account_suspension(uuid, text) to authenticated;

commit;
