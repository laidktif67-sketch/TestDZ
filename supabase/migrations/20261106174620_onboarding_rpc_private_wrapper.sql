-- TestDZ / 010_onboarding_rpc_private_wrapper
-- Keep SECURITY DEFINER implementation in a non-exposed schema.
-- The public RPC is SECURITY INVOKER and delegates only after auth.uid checks.
begin;

alter function public.complete_onboarding(text[], jsonb) set schema private;

grant usage on schema private to authenticated;
grant execute on function private.complete_onboarding(text[], jsonb) to authenticated;

create or replace function public.complete_onboarding(
  p_roles text[],
  p_interests jsonb default '[]'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.complete_onboarding(p_roles, p_interests);
$$;

revoke all on function public.complete_onboarding(text[], jsonb) from public, anon;
grant execute on function public.complete_onboarding(text[], jsonb) to authenticated;

commit;
