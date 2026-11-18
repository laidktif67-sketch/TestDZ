-- Atomic, owner-scoped creation and strict allowlist for the six-step test wizard.
-- Disposable local Supabase database only. All fixtures are rolled back.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('92900000-0000-4000-8000-000000000001','authenticated','authenticated','v2-six-step-dev@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Six Step Developer"}'::jsonb,now(),now()),
  ('92900000-0000-4000-8000-000000000002','authenticated','authenticated','v2-six-step-support@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Six Step Support"}'::jsonb,now(),now()),
  ('92900000-0000-4000-8000-000000000003','authenticated','authenticated','v2-six-step-outsider@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Six Step Outsider"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
  ('92900000-0000-4000-8000-000000000001','developer'),
  ('92900000-0000-4000-8000-000000000002','support');

INSERT INTO rebuild_v2.apps(developer_id,name,package_name,description,category,status)
VALUES
  ('92900000-0000-4000-8000-000000000001','Six Step Contract App','com.testdz.sixstep.contract','Synthetic app for the six-step contract test.','tools','published');

SET LOCAL ROLE authenticated;
DO $six_step_create_and_boundary$
DECLARE
  v_app uuid := (SELECT id FROM rebuild_v2.apps WHERE package_name='com.testdz.sixstep.contract');
  v_test uuid;
  v_config jsonb := '{
    "cohort":{"targetTesters":12,"notes":"Focus on supported devices"},
    "rules":{"androidVersion":"Any supported version","instructions":"Install and test core flows"},
    "details":{"testingObjective":"stability_bugs","priority":"high","testingScope":["core_flows","performance"],"successCriteria":"No critical bugs","minimumCompletionRate":80},
    "schedule":{"durationDays":14,"allowMoreTesters":true,"joiningMethod":"google_play_link","collectFeedback":true,"enableBugReports":false},
    "googlePlay":{"track":"internal","testerMethod":"join_link","appVersion":"latest_available","releaseMode":"immediately","releaseAt":null}
  }'::jsonb;
  v_saved jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','92900000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92900000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  v_test := rebuild_v2.create_test_with_config(
    v_app,'Six-step contract test','Synthetic description long enough for the V2 test creation contract.',
    NULL,'google_play_closed',12,CURRENT_DATE,CURRENT_DATE+14,NULL,
    'Install, test, and report reproducible issues.',v_config
  );

  SELECT test_config INTO v_saved FROM rebuild_v2.tests WHERE id=v_test;
  IF v_saved IS DISTINCT FROM v_config THEN
    RAISE EXCEPTION 'FAIL: six-step configuration was not persisted atomically';
  END IF;
  IF v_saved #> '{googlePlay,testerEmails}' IS NOT NULL
     OR v_saved #> '{googlePlay,googleGroup}' IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: tester contact data was persisted';
  END IF;

  -- Unknown keys are rejected; the client cannot smuggle raw email lists.
  BEGIN
    PERFORM rebuild_v2.create_test_with_config(
      v_app,'Invalid config test','Synthetic description long enough for the V2 test creation contract.',
      NULL,'google_play_closed',12,CURRENT_DATE,CURRENT_DATE+14,NULL,
      NULL,v_config || '{"googlePlay":{"track":"internal","testerMethod":"upload_list","appVersion":"latest_available","releaseMode":"immediately","testerEmails":["private@example.invalid"]}}'::jsonb
    );
    RAISE EXCEPTION 'FAIL: unapproved testerEmails configuration was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  -- Support role cannot create Developer tests.
  PERFORM set_config('request.jwt.claim.sub','92900000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92900000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.create_test_with_config(
      v_app,'Support forbidden test','Synthetic description long enough for the V2 test creation contract.',
      NULL,'google_play_closed',12,CURRENT_DATE,CURRENT_DATE+14,NULL,
      NULL,v_config
    );
    RAISE EXCEPTION 'FAIL: Support role created a Developer test';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- An authenticated user without a Developer role is denied as well.
  PERFORM set_config('request.jwt.claim.sub','92900000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92900000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.create_test_with_config(
      v_app,'Outsider forbidden test','Synthetic description long enough for the V2 test creation contract.',
      NULL,'google_play_closed',12,CURRENT_DATE,CURRENT_DATE+14,NULL,
      NULL,v_config
    );
    RAISE EXCEPTION 'FAIL: unrelated user created a Developer test';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- Malformed enum/range values must fail closed.
  PERFORM set_config('request.jwt.claim.sub','92900000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92900000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.create_test_with_config(
      v_app,'Invalid range test','Synthetic description long enough for the V2 test creation contract.',
      NULL,'google_play_closed',12,CURRENT_DATE,CURRENT_DATE+14,NULL,
      NULL,jsonb_set(v_config,'{details,minimumCompletionRate}','101'::jsonb)
    );
    RAISE EXCEPTION 'FAIL: invalid completion rate was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
END;
$six_step_create_and_boundary$;

RESET ROLE;
ROLLBACK;
SELECT 'rebuild_v2_developer_six_step_test_config_contract: PASS' AS result;
