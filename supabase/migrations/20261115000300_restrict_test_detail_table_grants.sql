-- Restrict API table privileges for test-detail child tables.
-- RLS policies remain the row-level boundary; grants are the table-level boundary.
begin;

revoke all privileges on table public.test_steps, public.test_requirements, public.test_media
  from anon, authenticated;

grant select, insert, update, delete
  on table public.test_steps, public.test_requirements, public.test_media
  to authenticated;

commit;
