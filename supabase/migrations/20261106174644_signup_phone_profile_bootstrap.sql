-- TestDZ / 011_signup_phone_profile_bootstrap
-- Phone is optional profile data only; it is not treated as verified.
begin;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_phone text;
begin
  v_display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name','')), '');
  if v_display_name is null then
    v_display_name := split_part(coalesce(new.email,''),'@',1);
  end if;
  v_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone','')), '');

  insert into public.profiles(id,display_name,locale,phone)
  values(new.id,v_display_name,'ar-DZ',v_phone)
  on conflict (id) do nothing;

  insert into public.user_roles(user_id,role)
  values(new.id,'tester')
  on conflict (user_id,role) do nothing;

  insert into public.wallets(user_id)
  values(new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

commit;
