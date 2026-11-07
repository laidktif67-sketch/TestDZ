BEGIN;
SELECT plan(11);

DO $setup$
DECLARE v_user uuid; v_app uuid; v_test uuid; v_i integer;
BEGIN
  CREATE TEMP TABLE c16d_fx (k text PRIMARY KEY, v uuid) ON COMMIT DROP;
  CREATE TEMP TABLE c16d_results (k text PRIMARY KEY, n integer) ON COMMIT DROP;

  FOR v_i IN 1..26 LOOP
    INSERT INTO auth.users
      (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', 'test-016d-' || v_i || '@testdz.local',
      now(), jsonb_build_object('full_name', '016d Dev ' || v_i))
    RETURNING id INTO v_user;
    INSERT INTO c16d_fx VALUES ('dev' || v_i, v_user);

    INSERT INTO public.apps (developer_id, name, package_name, category, status)
    VALUES (v_user, '016d App ' || v_i, 'com.testdz.016d.' || v_i, 'tools', 'published')
    RETURNING id INTO v_app;
    INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
    VALUES (v_app, v_user, '016d Test ' || v_i, 'recruiting', 12)
    RETURNING id INTO v_test;
    INSERT INTO c16d_fx VALUES ('test' || v_i, v_test);
  END LOOP;

  INSERT INTO public.apps (developer_id, name, package_name, category, status)
  VALUES ((SELECT v FROM c16d_fx WHERE k='dev1'),
    '016d Duplicate Owner App', 'com.testdz.016d.duplicate-owner', 'tools', 'published')
  RETURNING id INTO v_app;
  INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
  VALUES (v_app, (SELECT v FROM c16d_fx WHERE k='dev1'),
    '016d Duplicate Owner Test', 'recruiting', 12)
  RETURNING id INTO v_test;
  INSERT INTO c16d_fx VALUES ('test27', v_test);

  INSERT INTO public.user_roles (user_id, role)
  VALUES ((SELECT v FROM c16d_fx WHERE k='dev1'), 'admin');
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',
    (SELECT v::text FROM c16d_fx WHERE k='dev1'), true);
END
$setup$;

DO $test$
DECLARE v_ids uuid[]; v_cohort uuid;
BEGIN
  SELECT pg_catalog.array_agg(v ORDER BY substring(k from '[0-9]+')::integer)
  INTO v_ids FROM c16d_fx
  WHERE k LIKE 'test%' AND substring(k from '[0-9]+')::integer BETWEEN 1 AND 13;
  v_cohort := public.create_cohort('016d complete cohort', 13, v_ids);
  INSERT INTO c16d_fx VALUES ('full_cohort', v_cohort);
END
$test$;
SELECT is((SELECT count(*)::integer FROM public.cohort_tests
  WHERE cohort_id=(SELECT v FROM c16d_fx WHERE k='full_cohort')),
  13, 'create_cohort inserts exactly 13 test-owner pairs');

SELECT is((SELECT count(*)::integer FROM public.assignments
  WHERE cohort_id=(SELECT v FROM c16d_fx WHERE k='full_cohort')),
  156, 'create_cohort creates exactly 156 assignments');

SELECT is((SELECT count(*)::integer FROM public.assignments a
  JOIN public.cohort_tests ct ON ct.cohort_id=a.cohort_id AND ct.test_id=a.test_id
  WHERE a.cohort_id=(SELECT v FROM c16d_fx WHERE k='full_cohort')
    AND a.tester_id=ct.developer_id),
  0, 'create_cohort creates no self-test assignments');

DO $test$
DECLARE v_ids uuid[];
BEGIN
  SELECT pg_catalog.array_agg(v ORDER BY substring(k from '[0-9]+')::integer)
  INTO v_ids FROM c16d_fx
  WHERE k LIKE 'test%' AND substring(k from '[0-9]+')::integer BETWEEN 1 AND 12;
  BEGIN
    PERFORM public.create_cohort('016d incomplete', 13, v_ids);
    RAISE EXCEPTION 'TEST FAIL: INCOMPLETE_COHORT was not raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%INCOMPLETE_COHORT%' THEN RAISE; END IF;
  END;
END
$test$;
SELECT ok(true, 'create_cohort rejects 12 tests with INCOMPLETE_COHORT');

DO $test$
DECLARE v_ids uuid[];
BEGIN
  SELECT pg_catalog.array_agg(v ORDER BY substring(k from '[0-9]+')::integer)
  INTO v_ids FROM c16d_fx
  WHERE k LIKE 'test%' AND substring(k from '[0-9]+')::integer BETWEEN 1 AND 12;
  v_ids := v_ids || (SELECT v FROM c16d_fx WHERE k='test27');
  BEGIN
    PERFORM public.create_cohort('016d duplicate owners', 13, v_ids);
    RAISE EXCEPTION 'TEST FAIL: DUPLICATE_DEVELOPERS was not raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%DUPLICATE_DEVELOPERS%' THEN RAISE; END IF;
  END;
END
$test$;
SELECT ok(true, 'create_cohort rejects duplicate developers');

DO $test$
DECLARE v_cohort uuid; v_added integer;
BEGIN
  INSERT INTO public.cohorts (name, capacity, status)
  VALUES ('016d partial cohort', 13, 'forming') RETURNING id INTO v_cohort;
  INSERT INTO c16d_fx VALUES ('partial_cohort', v_cohort);

  INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
  SELECT v_cohort, t.id, t.developer_id
  FROM public.tests t
  WHERE t.id IN (SELECT v FROM c16d_fx
    WHERE k LIKE 'test%' AND substring(k from '[0-9]+')::integer BETWEEN 14 AND 25);

  v_added := public.add_cohort_test(v_cohort, (SELECT v FROM c16d_fx WHERE k='test26'));
  INSERT INTO c16d_results VALUES ('added_count', v_added);
  IF v_added <> 24 THEN
    RAISE EXCEPTION 'TEST FAIL: expected 24 new assignments, got %', v_added;
  END IF;
END
$test$;
SELECT is((SELECT count(*)::integer FROM public.assignments
  WHERE cohort_id=(SELECT v FROM c16d_fx WHERE k='partial_cohort')),
  156, 'add_cohort_test completes the 12-member partial cohort with 156 assignments');
SELECT is((SELECT n FROM c16d_results WHERE k='added_count'),
  24, 'add_cohort_test returns exactly 24 inserted assignments');

DO $test$
BEGIN
  BEGIN
    PERFORM public.add_cohort_test(
      (SELECT v FROM c16d_fx WHERE k='full_cohort'),
      (SELECT v FROM c16d_fx WHERE k='test27'));
    RAISE EXCEPTION 'TEST FAIL: COHORT_FULL was not raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%COHORT_FULL%' THEN RAISE; END IF;
  END;
END
$test$;
SELECT ok(true, 'add_cohort_test rejects a 13-member cohort with COHORT_FULL');

DO $test$
DECLARE
  v_cohort uuid := (SELECT v FROM c16d_fx WHERE k='partial_cohort');
  v_assignment uuid; v_tester uuid; v_deleted integer; v_before integer; v_after integer;
BEGIN
  SELECT a.id, a.tester_id INTO v_assignment, v_tester
  FROM public.assignments a
  WHERE a.cohort_id=v_cohort AND a.test_id=(SELECT v FROM c16d_fx WHERE k='test26')
  LIMIT 1;
  INSERT INTO public.feedback (assignment_id, tester_id, body)
  VALUES (v_assignment, v_tester, '016d feedback preservation test');

  BEGIN
    PERFORM public.remove_cohort_test(v_cohort, (SELECT v FROM c16d_fx WHERE k='test26'));
    RAISE EXCEPTION 'TEST FAIL: HAS_FEEDBACK was not raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%HAS_FEEDBACK%' THEN RAISE; END IF;
  END;

  DELETE FROM public.feedback WHERE assignment_id=v_assignment;
  SELECT count(*) INTO v_before FROM public.assignments WHERE cohort_id=v_cohort;
  v_deleted := public.remove_cohort_test(v_cohort, (SELECT v FROM c16d_fx WHERE k='test26'));
  SELECT count(*) INTO v_after FROM public.assignments WHERE cohort_id=v_cohort;
  IF v_deleted <> 24 OR v_before-v_after <> 24 THEN
    RAISE EXCEPTION 'TEST FAIL: expected 24 deleted; returned %, delta %', v_deleted, v_before-v_after;
  END IF;
END
$test$;
SELECT ok(true, 'remove_cohort_test protects feedback and deletes exactly 24 assignments');

DO $test$
BEGIN
  UPDATE public.cohorts SET status='ready'
  WHERE id=(SELECT v FROM c16d_fx WHERE k='partial_cohort');
  UPDATE public.cohorts SET status='running'
  WHERE id=(SELECT v FROM c16d_fx WHERE k='partial_cohort');
  BEGIN
    PERFORM public.remove_cohort_test(
      (SELECT v FROM c16d_fx WHERE k='partial_cohort'),
      (SELECT v FROM c16d_fx WHERE k='test25'));
    RAISE EXCEPTION 'TEST FAIL: NOT_FORMING was not raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%NOT_FORMING%' THEN RAISE; END IF;
  END;
END
$test$;
SELECT ok(true, 'remove_cohort_test rejects a running cohort with NOT_FORMING');

DO $test$
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',
    (SELECT v::text FROM c16d_fx WHERE k='dev2'), true);
  BEGIN
    PERFORM public.create_cohort(
      '016d non-admin', 13,
      ARRAY(SELECT v FROM c16d_fx
        WHERE k LIKE 'test%' AND substring(k from '[0-9]+')::integer BETWEEN 1 AND 13
        ORDER BY substring(k from '[0-9]+')::integer));
    RAISE EXCEPTION 'TEST FAIL: ADMIN_ONLY was not raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ADMIN_ONLY%' THEN RAISE; END IF;
  END;
END
$test$;
SELECT ok(true, 'create_cohort rejects non-admin callers');

SELECT * FROM finish();
ROLLBACK;
