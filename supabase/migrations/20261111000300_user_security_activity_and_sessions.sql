-- Expose only the signed-in user's own Supabase Auth security records.
-- No new tables are required; these functions read Supabase-managed auth tables.
create or replace function public.get_my_security_activity(p_limit integer default 30)
returns table (
  id uuid,
  event text,
  occurred_at timestamptz,
  ip_address text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ale.id,
    coalesce(ale.payload ->> 'action', ale.payload ->> 'event', 'Authentication event') as event,
    ale.created_at as occurred_at,
    nullif(ale.ip_address, '') as ip_address
  from auth.audit_log_entries ale
  where auth.uid() is not null
    and coalesce(ale.payload ->> 'actor_id', ale.payload ->> 'user_id') = auth.uid()::text
  order by ale.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

create or replace function public.get_my_active_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  ip_address text,
  assurance_level text,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.created_at,
    coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) as last_active_at,
    s.user_agent,
    case when s.ip is null then null else host(s.ip) end as ip_address,
    s.aal::text as assurance_level,
    s.id::text = (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id') as is_current
  from auth.sessions s
  where auth.uid() is not null
    and s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by is_current desc, last_active_at desc;
$$;

revoke all on function public.get_my_security_activity(integer) from public, anon;
revoke all on function public.get_my_active_sessions() from public, anon;
grant execute on function public.get_my_security_activity(integer) to authenticated;
grant execute on function public.get_my_active_sessions() to authenticated;
