-- Ensure onboarding cannot report success if the authenticated user's profile row is missing.
-- Keep the privileged implementation private and callable only through the public invoker wrapper.
begin;

create or replace function private.complete_onboarding(
  p_roles text[],
  p_interests jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_roles is null
     or cardinality(p_roles) < 1
     or cardinality(p_roles) > 2
     or exists (
       select 1
       from unnest(p_roles) as requested(role_name)
       where requested.role_name not in ('tester', 'developer')
     )
     or exists (
       select 1
       from unnest(p_roles) as requested(role_name)
       group by requested.role_name
       having count(*) > 1
     ) then
    raise exception 'invalid role selection' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_interests, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_interests, '[]'::jsonb)) > 20 then
    raise exception 'invalid interests' using errcode = '22023';
  end if;

  delete from public.user_roles
   where user_id = v_user_id
     and role in ('tester', 'developer');

  foreach v_role in array p_roles loop
    insert into public.user_roles(user_id, role)
    values (v_user_id, v_role)
    on conflict (user_id, role) do nothing;
  end loop;

  update public.profiles
     set interests = coalesce(p_interests, '[]'::jsonb),
         onboarding_completed_at = now(),
         updated_at = now()
   where id = v_user_id;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('status', 'ok', 'roles', to_jsonb(p_roles));
end;
$$;

revoke all on function private.complete_onboarding(text[], jsonb) from public, anon;
grant execute on function private.complete_onboarding(text[], jsonb) to authenticated;

commit;
