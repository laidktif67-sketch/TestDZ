-- Prevent direct client writes to test lifecycle and ownership fields.
-- Lifecycle transitions must be performed by trusted server-side operations.
begin;

revoke insert, update on table public.tests from anon, authenticated;

grant insert (
  app_id,
  developer_id,
  title,
  description,
  min_testers,
  start_date,
  end_date,
  short_summary,
  estimated_duration_minutes,
  android_min_api,
  android_max_api,
  device_requirements,
  eligibility_criteria,
  tester_instructions
) on table public.tests to authenticated;

grant update (
  title,
  description,
  min_testers,
  start_date,
  end_date,
  short_summary,
  estimated_duration_minutes,
  android_min_api,
  android_max_api,
  device_requirements,
  eligibility_criteria,
  tester_instructions
) on table public.tests to authenticated;

commit;
