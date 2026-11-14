-- Add explicit, validated campaign type and JSON configuration for the six-step developer wizard.
-- Draft is a real pre-recruitment state. Saving a draft never creates cohorts or starts recruitment.

begin;

alter table public.tests
  drop constraint if exists tests_status_check;

alter table public.tests
  add constraint tests_status_check
    check (status in ('draft','recruiting','ready','running','at_risk','completed','failed','cancelled'));

alter table public.tests
  add column test_type text not null default 'google_play_closed'
    check (test_type in (
      'google_play_closed',
      'apk_testing',
      'bug_discovery',
      'usability',
      'compatibility',
      'custom'
    )),
  add column test_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(test_config) = 'object');

-- Match the existing narrow developer-editable field policy and retain RLS ownership checks.
revoke update on public.tests from authenticated;
grant update (title, description, min_testers, start_date, end_date, test_type, test_config)
  on public.tests to authenticated;

commit;
