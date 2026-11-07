BEGIN;
SELECT plan(4);

-- ============================================================
-- SETUP: 4 users + 1 cohort + tests + assignment
-- ============================================================
DO $$
DECLARE
  v_dev_id uuid;
  v_tester_id uuid;
  v_outsider_id uuid;
  v_admin_id uuid;
  v_dev_app uuid;
  v_dev_test uuid;
  v_tester_app uuid;
  v_tester_test uuid;
  v_cohort uuid;
BEGIN
  -- Developer
  INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'dev-rls@testdz.local', now(),
          '{"full_name":"Dev"}') RETURNING id INTO v_dev_id;

  -- Tester
  INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'tester-rls@testdz.local', now(),
          '{"full_name":"Tester"}') RETURNING id INTO v_tester_id;

  -- Outsider
  INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'outsider-rls@testdz.local', now(),
          '{"full_name":"Outsider"}') RETURNING id INTO v_outsider_id;

  -- Admin (trigger creates tester role, we upgrade)
  INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', 'admin-rls@testdz.local', now(),
          '{"full_name":"Admin"}') RETURNING id INTO v_admin_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_admin_id, 'admin')
  ON CONFLICT DO NOTHING;

  -- Dev app + test
  INSERT INTO public.apps (developer_id, name, package_name, category, status)
  VALUES (v_dev_id, 'DevApp', 'com.testdz.rlsd', 'tools', 'published') RETURNING id INTO v_dev_app;
  INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
  VALUES (v_dev_app, v_dev_id, 'DevTest', 'recruiting', 12) RETURNING id INTO v_dev_test;

  -- Tester app + test (needed for tester to be in cohort)
  INSERT INTO public.apps (developer_id, name, package_name, category, status)
  VALUES (v_tester_id, 'TesterApp', 'com.testdz.rlst', 'tools', 'published') RETURNING id INTO v_tester_app;
  INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
  VALUES (v_tester_app, v_tester_id, 'TesterTest', 'recruiting', 12) RETURNING id INTO v_tester_test;

  -- Cohort
  INSERT INTO public.cohorts (name, capacity, status)
  VALUES ('RLS Cohort', 13, 'forming') RETURNING id INTO v_cohort;

  -- Add both tests to cohort
  INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id) VALUES
    (v_cohort, v_dev_test, v_dev_id),
    (v_cohort, v_tester_test, v_tester_id);

  -- Assignment: tester tests dev's app
  INSERT INTO public.assignments (cohort_id, test_id, tester_id, status)
  VALUES (v_cohort, v_dev_test, v_tester_id, 'active');

  -- Store IDs in session config
  PERFORM set_config('test.dev', v_dev_id::text, false);
  PERFORM set_config('test.tester', v_tester_id::text, false);
  PERFORM set_config('test.outsider', v_outsider_id::text, false);
  PERFORM set_config('test.admin', v_admin_id::text, false);
  PERFORM set_config('test.cohort', v_cohort::text, false);
END $$;

-- ============================================================
-- TEST 1: Developer sees own cohort
-- ============================================================
SAVEPOINT sp1;
SELECT set_config('request.jwt.claim.sub', current_setting('test.dev'), true);
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.dev'))::text, true);
SET LOCAL role = 'authenticated';
SELECT is(
  (SELECT COUNT(*) FROM public.cohorts WHERE id=current_setting('test.cohort')::uuid),
  1::bigint,
  'TEST 1: Developer sees own cohort'
);
SET LOCAL role = 'postgres';
ROLLBACK TO SAVEPOINT sp1;
RELEASE SAVEPOINT sp1;

-- ============================================================
-- TEST 2: Tester sees cohort
-- ============================================================
SAVEPOINT sp2;
SELECT set_config('request.jwt.claim.sub', current_setting('test.tester'), true);
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.tester'))::text, true);
SET LOCAL role = 'authenticated';
SELECT is(
  (SELECT COUNT(*) FROM public.cohorts WHERE id=current_setting('test.cohort')::uuid),
  1::bigint,
  'TEST 2: Tester sees cohort'
);
SET LOCAL role = 'postgres';
ROLLBACK TO SAVEPOINT sp2;
RELEASE SAVEPOINT sp2;

-- ============================================================
-- TEST 3: Outsider blocked
-- ============================================================
SAVEPOINT sp3;
SELECT set_config('request.jwt.claim.sub', current_setting('test.outsider'), true);
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.outsider'))::text, true);
SET LOCAL role = 'authenticated';
SELECT is(
  (SELECT COUNT(*) FROM public.cohorts WHERE id=current_setting('test.cohort')::uuid),
  0::bigint,
  'TEST 3: Outsider blocked'
);
SET LOCAL role = 'postgres';
ROLLBACK TO SAVEPOINT sp3;
RELEASE SAVEPOINT sp3;

-- ============================================================
-- TEST 4: Admin sees cohort
-- ============================================================
SAVEPOINT sp4;
SELECT set_config('request.jwt.claim.sub', current_setting('test.admin'), true);
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub', current_setting('test.admin'))::text, true);
SET LOCAL role = 'authenticated';
SELECT is(
  (SELECT COUNT(*) FROM public.cohorts WHERE id=current_setting('test.cohort')::uuid),
  1::bigint,
  'TEST 4: Admin sees cohort'
);
SET LOCAL role = 'postgres';
ROLLBACK TO SAVEPOINT sp4;
RELEASE SAVEPOINT sp4;

SELECT * FROM finish();
ROLLBACK;
