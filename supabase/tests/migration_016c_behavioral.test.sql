BEGIN;
SELECT plan(14);

-- ============================================================
-- SETUP: Fixtures (14 devs, 14 tests)
-- ============================================================
DO $$
DECLARE
  v_dev_ids uuid[] := ARRAY[]::uuid[];
  v_test_ids uuid[] := ARRAY[]::uuid[];
  v_app_id uuid; v_test_id uuid; v_dev_id uuid; v_i int;
BEGIN
  FOR v_i IN 1..14 LOOP
    INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', 'test-016c-'||v_i||'@testdz.local',
            now(), jsonb_build_object('full_name','016c Dev '||v_i))
    RETURNING id INTO v_dev_id;
    v_dev_ids := v_dev_ids || v_dev_id;
    
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_dev_id) THEN
      RAISE EXCEPTION 'Trigger failed to create profile for %', v_dev_id;
    END IF;
    
    INSERT INTO public.apps (developer_id, name, package_name, category, status)
    VALUES (v_dev_id, 'App '||v_i, 'com.testdz.c16-'||v_i, 'tools', 'published')
    RETURNING id INTO v_app_id;
    
    INSERT INTO public.tests (app_id, developer_id, title, status, min_testers)
    VALUES (v_app_id, v_dev_id, 'Test '||v_i, 'recruiting', 12)
    RETURNING id INTO v_test_id;
    v_test_ids := v_test_ids || v_test_id;
  END LOOP;
  
  CREATE TEMP TABLE IF NOT EXISTS c16_fx (k text PRIMARY KEY, v uuid) ON COMMIT DROP;
  DELETE FROM c16_fx;
  FOR v_i IN 1..14 LOOP
    INSERT INTO c16_fx VALUES ('dev'||v_i, v_dev_ids[v_i]);
    INSERT INTO c16_fx VALUES ('test'||v_i, v_test_ids[v_i]);
  END LOOP;
END $$;

-- ============================================================
-- TEST 1: 14 devs created
-- ============================================================
SELECT is((SELECT COUNT(*)::int FROM c16_fx WHERE k LIKE 'dev%'), 14, 'TEST 1: 14 devs created');

-- ============================================================
-- TEST 2: 13 cohort_tests inserted
-- ============================================================
DO $$
DECLARE v_cohort uuid; v_i int;
BEGIN
  INSERT INTO public.cohorts (name, capacity, status)
  VALUES ('c16-cap', 13, 'forming') RETURNING id INTO v_cohort;
  INSERT INTO c16_fx VALUES ('cohort', v_cohort);
  FOR v_i IN 1..13 LOOP
    INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
    SELECT v_cohort, (SELECT v FROM c16_fx WHERE k='test'||v_i),
                     (SELECT v FROM c16_fx WHERE k='dev'||v_i);
  END LOOP;
END $$;

SELECT is((SELECT COUNT(*)::int FROM public.cohort_tests
           WHERE cohort_id=(SELECT v FROM c16_fx WHERE k='cohort')), 13, 'TEST 2: 13 cohort_tests');

-- ============================================================
-- TEST 3: Capacity blocks 14th
-- ============================================================
DO $$
DECLARE v_cohort uuid := (SELECT v FROM c16_fx WHERE k='cohort');
BEGIN
  BEGIN
    INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
    SELECT v_cohort, (SELECT v FROM c16_fx WHERE k='test14'),
                     (SELECT v FROM c16_fx WHERE k='dev14');
    RAISE EXCEPTION 'TEST 3 FAIL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%COHORT_FULL%' THEN RAISE; END IF;
  END;
END $$;
SELECT ok(true, 'TEST 3: capacity blocks 14th');

-- ============================================================
-- TEST 4: Capacity reduction rejected
-- ============================================================
DO $$
DECLARE v_cohort uuid := (SELECT v FROM c16_fx WHERE k='cohort');
BEGIN
  BEGIN
    UPDATE public.cohorts SET capacity=5 WHERE id=v_cohort;
    RAISE EXCEPTION 'TEST 4 FAIL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CAPACITY_BELOW_MEMBER_COUNT%' THEN RAISE; END IF;
  END;
END $$;
SELECT ok(true, 'TEST 4: capacity reduction rejected');

-- ============================================================
-- TEST 5: Self-test INSERT blocked
-- ============================================================
DO $$
DECLARE v_cohort uuid := (SELECT v FROM c16_fx WHERE k='cohort');
        v_test1 uuid := (SELECT v FROM c16_fx WHERE k='test1');
        v_dev1 uuid := (SELECT v FROM c16_fx WHERE k='dev1');
BEGIN
  BEGIN
    INSERT INTO public.assignments (cohort_id, test_id, tester_id, status)
    VALUES (v_cohort, v_test1, v_dev1, 'active');
    RAISE EXCEPTION 'TEST 5 FAIL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%SELF_TEST_FORBIDDEN%' THEN RAISE; END IF;
  END;
END $$;
SELECT ok(true, 'TEST 5: self-test INSERT blocked');

-- ============================================================
-- TEST 6: Self-test UPDATE blocked
-- ============================================================
DO $$
DECLARE v_cohort uuid := (SELECT v FROM c16_fx WHERE k='cohort');
        v_test1 uuid := (SELECT v FROM c16_fx WHERE k='test1');
        v_dev1 uuid := (SELECT v FROM c16_fx WHERE k='dev1');
        v_dev2 uuid := (SELECT v FROM c16_fx WHERE k='dev2');
        v_aid uuid;
BEGIN
  INSERT INTO public.assignments (cohort_id, test_id, tester_id, status)
  VALUES (v_cohort, v_test1, v_dev2, 'active') RETURNING id INTO v_aid;
  BEGIN
    UPDATE public.assignments SET tester_id=v_dev1 WHERE id=v_aid;
    RAISE EXCEPTION 'TEST 6 FAIL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%SELF_TEST_FORBIDDEN%' THEN RAISE; END IF;
  END;
END $$;
SELECT ok(true, 'TEST 6: self-test UPDATE blocked');

-- ============================================================
-- TEST 7: Invalid status transition rejected
-- ============================================================
DO $$
DECLARE v_cohort uuid := (SELECT v FROM c16_fx WHERE k='cohort');
BEGIN
  UPDATE public.cohorts SET status='ready' WHERE id=v_cohort;
  UPDATE public.cohorts SET status='running' WHERE id=v_cohort;
  UPDATE public.cohorts SET status='completed' WHERE id=v_cohort;
  BEGIN
    UPDATE public.cohorts SET status='running' WHERE id=v_cohort;
    RAISE EXCEPTION 'TEST 7 FAIL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%INVALID_STATUS_TRANSITION%' THEN RAISE; END IF;
  END;
END $$;
SELECT ok(true, 'TEST 7: completed -> running rejected');

-- ============================================================
-- TEST 8: is_active stays true (forming -> ready -> running)
-- ============================================================
DO $$
DECLARE v_cohort uuid; v_count int;
BEGIN
  INSERT INTO public.cohorts (name, capacity, status)
  VALUES ('isa-1', 13, 'forming') RETURNING id INTO v_cohort;
  INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
  SELECT v_cohort, (SELECT v FROM c16_fx WHERE k='test1'), (SELECT v FROM c16_fx WHERE k='dev1');
  
  UPDATE public.cohorts SET status='ready' WHERE id=v_cohort;
  SELECT COUNT(*) INTO v_count FROM public.cohort_tests WHERE cohort_id=v_cohort AND is_active=true;
  IF v_count != 1 THEN RAISE EXCEPTION 'TEST 8 FAIL ready'; END IF;
  
  UPDATE public.cohorts SET status='running' WHERE id=v_cohort;
  SELECT COUNT(*) INTO v_count FROM public.cohort_tests WHERE cohort_id=v_cohort AND is_active=true;
  IF v_count != 1 THEN RAISE EXCEPTION 'TEST 8 FAIL running'; END IF;
END $$;
SELECT ok(true, 'TEST 8: is_active stays true (forming -> ready -> running)');

-- ============================================================
-- TEST 9: is_active false (running -> completed)
-- ============================================================
DO $$
DECLARE v_cohort uuid; v_count int;
BEGIN
  INSERT INTO public.cohorts (name, capacity, status)
  VALUES ('isa-2', 13, 'forming') RETURNING id INTO v_cohort;
  INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
  SELECT v_cohort, (SELECT v FROM c16_fx WHERE k='test2'), (SELECT v FROM c16_fx WHERE k='dev2');
  
  UPDATE public.cohorts SET status='ready' WHERE id=v_cohort;
  UPDATE public.cohorts SET status='running' WHERE id=v_cohort;
  UPDATE public.cohorts SET status='completed' WHERE id=v_cohort;
  SELECT COUNT(*) INTO v_count FROM public.cohort_tests WHERE cohort_id=v_cohort AND is_active=true;
  IF v_count != 0 THEN RAISE EXCEPTION 'TEST 9 FAIL'; END IF;
END $$;
SELECT ok(true, 'TEST 9: is_active false (running -> completed)');

-- ============================================================
-- TEST 10: is_active false (running -> cancelled)
-- ============================================================
DO $$
DECLARE v_cohort uuid; v_count int;
BEGIN
  INSERT INTO public.cohorts (name, capacity, status)
  VALUES ('isa-3', 13, 'forming') RETURNING id INTO v_cohort;
  INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
  SELECT v_cohort, (SELECT v FROM c16_fx WHERE k='test3'), (SELECT v FROM c16_fx WHERE k='dev3');
  
  UPDATE public.cohorts SET status='ready' WHERE id=v_cohort;
  UPDATE public.cohorts SET status='running' WHERE id=v_cohort;
  UPDATE public.cohorts SET status='cancelled' WHERE id=v_cohort;
  SELECT COUNT(*) INTO v_count FROM public.cohort_tests WHERE cohort_id=v_cohort AND is_active=true;
  IF v_count != 0 THEN RAISE EXCEPTION 'TEST 10 FAIL'; END IF;
END $$;
SELECT ok(true, 'TEST 10: is_active false (running -> cancelled)');

-- ============================================================
-- TEST 11: cohort_id mutation blocked
-- ============================================================
DO $$
DECLARE v_cohort uuid := (SELECT v FROM c16_fx WHERE k='cohort');
        v_test1 uuid := (SELECT v FROM c16_fx WHERE k='test1');
BEGIN
  BEGIN
    UPDATE public.cohort_tests SET cohort_id=gen_random_uuid()
    WHERE cohort_id=v_cohort AND test_id=v_test1;
    RAISE EXCEPTION 'TEST 11 FAIL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%COHORT_TEST_IMMUTABLE_KEYS%' THEN RAISE; END IF;
  END;
END $$;
SELECT ok(true, 'TEST 11: cohort_id mutation blocked');

-- ============================================================
-- TEST 12: test_id mutation blocked
-- ============================================================
DO $$
DECLARE v_cohort uuid := (SELECT v FROM c16_fx WHERE k='cohort');
        v_test1 uuid := (SELECT v FROM c16_fx WHERE k='test1');
BEGIN
  BEGIN
    UPDATE public.cohort_tests SET test_id=gen_random_uuid()
    WHERE cohort_id=v_cohort AND test_id=v_test1;
    RAISE EXCEPTION 'TEST 12 FAIL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%COHORT_TEST_IMMUTABLE_KEYS%' THEN RAISE; END IF;
  END;
END $$;
SELECT ok(true, 'TEST 12: test_id mutation blocked');

-- ============================================================
-- TEST 13: developer_id mutation blocked
-- ============================================================
DO $$
DECLARE v_cohort uuid := (SELECT v FROM c16_fx WHERE k='cohort');
        v_test1 uuid := (SELECT v FROM c16_fx WHERE k='test1');
BEGIN
  BEGIN
    UPDATE public.cohort_tests SET developer_id=gen_random_uuid()
    WHERE cohort_id=v_cohort AND test_id=v_test1;
    RAISE EXCEPTION 'TEST 13 FAIL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%COHORT_TEST_IMMUTABLE_KEYS%' THEN RAISE; END IF;
  END;
END $$;
SELECT ok(true, 'TEST 13: developer_id mutation blocked');

-- ============================================================
-- TEST 14: test cannot be in 2 active cohorts, reusable after completion
-- ============================================================
DO $$
DECLARE
  v_cohort_a uuid;
  v_cohort_b uuid;
  v_test4 uuid := (SELECT v FROM c16_fx WHERE k='test4');
  v_dev4 uuid := (SELECT v FROM c16_fx WHERE k='dev4');
BEGIN
  INSERT INTO public.cohorts (name, capacity, status)
  VALUES ('dual-a', 13, 'forming') RETURNING id INTO v_cohort_a;
  INSERT INTO public.cohorts (name, capacity, status)
  VALUES ('dual-b', 13, 'forming') RETURNING id INTO v_cohort_b;
  
  INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
  VALUES (v_cohort_a, v_test4, v_dev4);
  
  BEGIN
    INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
    VALUES (v_cohort_b, v_test4, v_dev4);
    RAISE EXCEPTION 'TEST 14 FAIL: test in 2 active cohorts allowed';
  EXCEPTION WHEN unique_violation THEN
    DECLARE
      v_constraint text;
    BEGIN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;

      IF v_constraint IS DISTINCT FROM 'cohort_tests_test_one_active' THEN
        RAISE EXCEPTION
          'TEST 14 FAIL: unique_violation on unexpected constraint/index: %',
          COALESCE(v_constraint, '<NULL>');
      END IF;

      -- Confirm the conflicting active row is the same test in another cohort.
      IF NOT EXISTS (
        SELECT 1
        FROM public.cohort_tests
        WHERE test_id = v_test4
          AND is_active = true
          AND cohort_id = v_cohort_a
      ) THEN
        RAISE EXCEPTION
          'TEST 14 FAIL: expected active test conflict in cohort % was not found',
          v_cohort_a;
      END IF;
    END;
  END;
  
  UPDATE public.cohorts SET status='ready' WHERE id=v_cohort_a;
  UPDATE public.cohorts SET status='running' WHERE id=v_cohort_a;
  UPDATE public.cohorts SET status='completed' WHERE id=v_cohort_a;
  
  INSERT INTO public.cohort_tests (cohort_id, test_id, developer_id)
  VALUES (v_cohort_b, v_test4, v_dev4);
  
  IF NOT EXISTS (
    SELECT 1 FROM public.cohort_tests
    WHERE cohort_id=v_cohort_b AND test_id=v_test4
  ) THEN
    RAISE EXCEPTION 'TEST 14 FAIL: test not reusable after cohort completed';
  END IF;
END $$;
SELECT ok(true, 'TEST 14: test cannot be in 2 active cohorts, reusable after completion');

SELECT * FROM finish();
ROLLBACK;
