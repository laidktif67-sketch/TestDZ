-- Six-step wizard config is validated and committed with its test draft in one transaction.
-- Run only on the disposable rebuild_v2 candidate after all numbered SQL scripts.

BEGIN;
INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
('51000000-0000-4000-8000-000000000001','authenticated','authenticated','six-step-dev@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
('51000000-0000-4000-8000-000000000002','authenticated','authenticated','six-step-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
('51000000-0000-4000-8000-000000000003','authenticated','authenticated','six-step-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
INSERT INTO rebuild_v2.user_roles(user_id,role) VALUES
('51000000-0000-4000-8000-000000000001','developer'),
('51000000-0000-4000-8000-000000000002','admin');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $test$
DECLARE v_app uuid; v_test uuid; v_count integer;
v_config jsonb := '{
"cohort":{"targetTesters":24,"notes":"Focus on core flows"},
"rules":{"androidVersion":"Android 12+","instructions":"Complete the main purchase flow"},
"details":{"testingObjective":"stability_bugs","priority":"high","testingScope":["core_flows","performance"],"successCriteria":"No critical bugs","minimumCompletionRate":80},
"schedule":{"durationDays":14,"allowMoreTesters":true,"joiningMethod":"google_play_link","collectFeedback":true,"enableBugReports":true},
"googlePlay":{"track":"closed","testerMethod":"upload_list","appVersion":"latest_available","releaseMode":"scheduled","releaseAt":"2026-12-01T10:00"}
}'::jsonb;
BEGIN
  v_app:=rebuild_v2.create_app('Six Step Contract App','dz.testdz.sixstep','Synthetic app for six-step contract tests only.','tools');
  PERFORM rebuild_v2.submit_app_for_review(v_app);
  PERFORM set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  PERFORM rebuild_v2.review_app(v_app,'approved','Approved for isolated contract testing');
  PERFORM set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  v_test:=rebuild_v2.create_test_with_config(v_app,'Six Step Wizard Contract','A complete description for the six-step wizard contract test.','Wizard contract','google_play_closed',24,current_date,current_date+14,30,'Follow the supplied test instructions.',v_config);
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.tests WHERE id=v_test AND status='draft' AND test_config=v_config) THEN
    RAISE EXCEPTION 'FAIL: six-step configuration was not saved with draft';
  END IF;
  IF (SELECT count(*) FROM rebuild_v2.audit_events WHERE target_id=v_test AND action IN ('test.created','test.six_step_config.saved'))<>2 THEN
    RAISE EXCEPTION 'FAIL: expected create/config audit events missing';
  END IF;

  BEGIN
    PERFORM rebuild_v2.create_test_with_config(v_app,'Mismatched Target Test','A complete description for a mismatched target validation.','Mismatch','custom',24,NULL,NULL,30,'Follow the supplied test instructions.',
      jsonb_set(v_config,'{cohort,targetTesters}','25'::jsonb));
    RAISE EXCEPTION 'FAIL: mismatched target count was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM rebuild_v2.create_test_with_config(v_app,'Invalid Config Test','A complete description for invalid config validation.','Invalid','custom',12,NULL,NULL,30,NULL,
      v_config || '{"googlePlay":{"track":"closed","testerMethod":"upload_list","appVersion":"latest_available","releaseMode":"immediately","testerEmails":["private@example.com"]}}'::jsonb);
    RAISE EXCEPTION 'FAIL: raw tester emails were accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  SELECT count(*) INTO v_count FROM rebuild_v2.tests WHERE developer_id='51000000-0000-4000-8000-000000000001';
  IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: invalid config left a partial test draft'; END IF;

  PERFORM set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.create_test_with_config(v_app,'Tester Cannot Create','A complete description that must not be accepted.','Nope','custom',12,NULL,NULL,30,NULL,v_config);
    RAISE EXCEPTION 'FAIL: tester created a developer test';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END;
$test$;
RESET ROLE;
ROLLBACK;
