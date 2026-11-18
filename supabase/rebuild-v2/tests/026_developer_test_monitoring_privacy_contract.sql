-- Developer monitoring exposes only owner-scoped aggregate metrics.
-- Individual tester IDs, assignment IDs, notes, evidence paths and feedback bodies stay private.
-- Run after all numbered candidate SQL scripts on a disposable rebuild_v2 database.

BEGIN;
INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
('53000000-0000-4000-8000-000000000001','authenticated','authenticated','monitor-dev@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
('53000000-0000-4000-8000-000000000002','authenticated','authenticated','monitor-other-dev@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
('53000000-0000-4000-8000-000000000003','authenticated','authenticated','monitor-tester-one@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
('53000000-0000-4000-8000-000000000004','authenticated','authenticated','monitor-tester-two@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
('53000000-0000-4000-8000-000000000005','authenticated','authenticated','monitor-tester-three@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
('53000000-0000-4000-8000-000000000006','authenticated','authenticated','monitor-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
INSERT INTO rebuild_v2.user_roles(user_id,role) VALUES
('53000000-0000-4000-8000-000000000001','developer'),
('53000000-0000-4000-8000-000000000002','developer'),
('53000000-0000-4000-8000-000000000006','admin');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','53000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"53000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $test$
DECLARE v_app uuid; v_test uuid;
BEGIN
  v_app:=rebuild_v2.create_app('Monitoring Contract App','dz.testdz.monitoring','Synthetic app for the privacy-safe monitoring contract.','tools');
  PERFORM rebuild_v2.submit_app_for_review(v_app);
  PERFORM set_config('request.jwt.claim.sub','53000000-0000-4000-8000-000000000006',true);
  PERFORM set_config('request.jwt.claims','{"sub":"53000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
  PERFORM rebuild_v2.review_app(v_app,'approved','Approve synthetic monitoring fixture');
  PERFORM set_config('request.jwt.claim.sub','53000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"53000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  v_test:=rebuild_v2.create_test(v_app,'Monitoring Privacy Contract','Synthetic test used to verify aggregate-only monitoring access.','Monitoring contract','custom',3,NULL,NULL,30,'Complete the main test flow');
  PERFORM set_config('testdz.monitoring_test_id',v_test::text,true);
END;
$test$;
RESET ROLE;

-- Trusted fixture rows intentionally include sensitive values that must never appear in the RPC response.
INSERT INTO rebuild_v2.cohorts(id,name,capacity,status,created_by)
VALUES('53100000-0000-4000-8000-000000000001','Monitoring Contract Cohort',10,'running','53000000-0000-4000-8000-000000000001');
INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
VALUES('53100000-0000-4000-8000-000000000001',current_setting('testdz.monitoring_test_id')::uuid,'53000000-0000-4000-8000-000000000001');
INSERT INTO rebuild_v2.assignments(id,cohort_id,test_id,tester_id,status,assigned_at,started_at,completed_at)
VALUES
('53200000-0000-4000-8000-000000000001','53100000-0000-4000-8000-000000000001',current_setting('testdz.monitoring_test_id')::uuid,'53000000-0000-4000-8000-000000000003','completed',now(),now(),now()),
('53200000-0000-4000-8000-000000000002','53100000-0000-4000-8000-000000000001',current_setting('testdz.monitoring_test_id')::uuid,'53000000-0000-4000-8000-000000000004','active',now(),now(),NULL),
('53200000-0000-4000-8000-000000000003','53100000-0000-4000-8000-000000000001',current_setting('testdz.monitoring_test_id')::uuid,'53000000-0000-4000-8000-000000000005','pending',now(),NULL,NULL);
INSERT INTO rebuild_v2.checkins(assignment_id,tester_id,checkin_date,note,evidence_path,created_at)
VALUES
('53200000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000003',current_date,'PRIVATE_CHECKIN_NOTE_DO_NOT_EXPOSE','private/evidence/secret-one.png',now()),
('53200000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000004',current_date,'PRIVATE_CHECKIN_NOTE_DO_NOT_EXPOSE','private/evidence/secret-two.png',now()),
('53200000-0000-4000-8000-000000000003','53000000-0000-4000-8000-000000000005',current_date,'PRIVATE_CHECKIN_NOTE_DO_NOT_EXPOSE','private/evidence/secret-three.png',now());
INSERT INTO rebuild_v2.feedback(assignment_id,tester_id,category,body,rating,created_at)
VALUES('53200000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000003','general','PRIVATE_FEEDBACK_BODY_DO_NOT_EXPOSE',5,now());

-- One tester generates four events yesterday; the daily chart must suppress that day.
UPDATE rebuild_v2.assignments
SET assigned_at=now()-interval '1 day',
    started_at=now()-interval '1 day',
    completed_at=now()-interval '1 day'
WHERE id='53200000-0000-4000-8000-000000000001';
UPDATE rebuild_v2.checkins
SET checkin_date=(current_date-1),
    created_at=now()-interval '1 day'
WHERE assignment_id='53200000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','53000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"53000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $assert$
DECLARE v_test uuid:=current_setting('testdz.monitoring_test_id')::uuid; v_payload jsonb; v_count integer; v_text text;
BEGIN
  v_payload:=rebuild_v2.get_developer_test_monitoring(v_test);
  IF v_payload->'metrics'->>'totalAssignments'<>'3'
     OR v_payload->'metrics'->>'uniqueTesters'<>'3'
     OR v_payload->'metrics'->>'pending'<>'1'
     OR v_payload->'metrics'->>'active'<>'1'
     OR v_payload->'metrics'->>'completed'<>'1'
     OR v_payload->'metrics'->>'checkins'<>'3'
     OR v_payload->'metrics'->>'feedbackCount'<>'1'
     OR v_payload->'metrics'->>'averageRating'<>'5.00' THEN
    RAISE EXCEPTION 'FAIL: aggregate monitoring metrics incorrect: %',v_payload->'metrics';
  END IF;
  IF jsonb_array_length(v_payload->'dailyActivity')<>1
     OR (v_payload->'dailyActivity'->0->>'count')::integer<3
     OR v_payload->'dailyActivity'->0->>'date'<>(now() AT TIME ZONE 'Africa/Algiers')::date::text THEN
    RAISE EXCEPTION 'FAIL: daily activity must include only dates with at least three distinct testers';
  END IF;
  v_text:=v_payload::text;
  IF position('53000000-0000-4000-8000-000000000003' IN v_text)>0
     OR position('53000000-0000-4000-8000-000000000004' IN v_text)>0
     OR position('53000000-0000-4000-8000-000000000005' IN v_text)>0
     OR position('monitor-tester-' IN v_text)>0
     OR position('PRIVATE_CHECKIN_NOTE_DO_NOT_EXPOSE' IN v_text)>0
     OR position('private/evidence/' IN v_text)>0
     OR position('PRIVATE_FEEDBACK_BODY_DO_NOT_EXPOSE' IN v_text)>0
     OR position('53200000-0000-4000-8000-000000000001' IN v_text)>0 THEN
    RAISE EXCEPTION 'FAIL: monitoring RPC exposed tester identity or raw private content';
  END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.assignments WHERE test_id=v_test;
  IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: developer can read raw assignments'; END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.checkins;
  IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: developer can read raw check-ins'; END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.feedback;
  IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: developer can read raw feedback'; END IF;

  PERFORM set_config('request.jwt.claim.sub','53000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"53000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.get_developer_test_monitoring(v_test);
    RAISE EXCEPTION 'FAIL: unrelated developer read another developer monitoring';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub','53000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"53000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.get_developer_test_monitoring(v_test);
    RAISE EXCEPTION 'FAIL: tester read developer monitoring';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END;
$assert$;
RESET ROLE;
ROLLBACK;
SELECT 'rebuild_v2_developer_test_monitoring_privacy_contract: PASS' AS result;
