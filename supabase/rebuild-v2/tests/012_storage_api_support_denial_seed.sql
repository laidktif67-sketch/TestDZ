-- Disposable local-only fixture for the Storage HTTP API authorization contract.
-- Creates one tester submission and its registered attachment metadata; the workflow
-- uploads the bytes as the tester, verifies tester download, then verifies Support denial.

BEGIN;
INSERT INTO auth.users
 (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
 ('80000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-feedback-dev@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Feedback Owner"}'::jsonb,now(),now()),
 ('80000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-feedback-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Feedback Admin"}'::jsonb,now(),now()),
 ('80000000-0000-4000-8000-000000000003','authenticated','authenticated','v2-feedback-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Feedback Tester"}'::jsonb,now(),now()),
 ('80000000-0000-4000-8000-000000000004','authenticated','authenticated','v2-feedback-outsider@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Other Developer"}'::jsonb,now(),now()),
 ('80000000-0000-4000-8000-000000000005','authenticated','authenticated','v2-feedback-support@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Support Agent"}'::jsonb,now(),now()),
 ('80000000-0000-4000-8000-000000000006','authenticated','authenticated','v2-feedback-other-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Other Tester"}'::jsonb,now(),now()),

-- The auth-user trigger grants the default tester role to every new account.
-- Remove that default from synthetic staff/outsider fixtures before assigning their intended roles.
DELETE FROM rebuild_v2.user_roles
WHERE user_id IN (
 '80000000-0000-4000-8000-000000000001',
 '80000000-0000-4000-8000-000000000002',
 '80000000-0000-4000-8000-000000000004',
 '80000000-0000-4000-8000-000000000005'
) AND role='tester';

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES
 ('80000000-0000-4000-8000-000000000001','developer'),
 ('80000000-0000-4000-8000-000000000002','admin'),
 ('80000000-0000-4000-8000-000000000003','tester'),
 ('80000000-0000-4000-8000-000000000004','developer'),
 ('80000000-0000-4000-8000-000000000005','support')
ON CONFLICT(user_id,role) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

DO $create_workflow$
DECLARE
 v_app uuid;
 v_test uuid;
 v_cohort uuid;
 v_assignment uuid;
 v_submission uuid;
 v_storage_path text;
 v_feedback uuid;
 v_request uuid;
BEGIN
 v_app:=rebuild_v2.create_app(
  'Feedback Privacy App','dz.testdz.feedback_privacy',
  'Synthetic app used to verify private developer feedback access controls.','tools'
 );
 PERFORM rebuild_v2.submit_app_for_review(v_app);

 PERFORM set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
 PERFORM set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
 PERFORM rebuild_v2.review_app(v_app,'approved','Contract app approval');

 PERFORM set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 v_test:=rebuild_v2.create_test(
  v_app,'Private Feedback Test',
  'Synthetic test used to verify developer feedback ownership and privacy boundaries.',
  'Privacy contract','usability',1,NULL,NULL,30,'Review the app and submit feedback.'
 );
 PERFORM rebuild_v2.submit_test_for_review(v_test);

 PERFORM set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
 PERFORM set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
 PERFORM rebuild_v2.review_test(v_test,'approved','Contract test approval');

 PERFORM set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 v_cohort:=rebuild_v2.create_test_cohort(v_test,'Feedback Privacy Cohort',1,NULL,NULL);

 PERFORM set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000003',true);
 PERFORM set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
 v_assignment:=rebuild_v2.join_test(v_test);
 PERFORM set_config('testdz.cohort_id',v_cohort::text,true);
 PERFORM set_config('testdz.assignment_id',v_assignment::text,true);
 PERFORM set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 PERFORM rebuild_v2.transition_test_cohort(v_cohort,'ready','Minimum tester count reached');
 PERFORM rebuild_v2.transition_test_cohort(v_cohort,'running','Begin feedback privacy contract');
 PERFORM set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000003',true);
 PERFORM set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
 PERFORM rebuild_v2.start_assignment(v_assignment);
 PERFORM rebuild_v2.submit_checkin(v_assignment,'Synthetic private check-in note for Support boundary verification.');
 v_submission:=rebuild_v2.create_assignment_submission(v_assignment,'Synthetic submission summary used to verify tester evidence privacy boundaries.','Synthetic comments.');
 v_storage_path:=rebuild_v2.register_assignment_submission_attachment(v_submission,'80000000-0000-4000-8000-000000000099'::uuid,'png','privacy-evidence.png','image/png',1024);
 v_feedback:=rebuild_v2.submit_tester_feedback(
  v_assignment,'usability',
  'The app navigation is confusing and the settings control is difficult to locate during the test.',
  3::smallint
 );

 -- Reuse the existing tester assignment. Its check-in is for today,
 -- so the earlier target date is valid and no second cohort is needed.
 PERFORM set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000003',true);
 PERFORM set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
 v_request:=rebuild_v2.create_medical_exception_request(
   v_assignment,
   'Synthetic medical evidence request for isolated Storage HTTP authorization.',
   ARRAY[rebuild_v2_private.algeria_local_date()-4]::date[]
 );
 PERFORM set_config('testdz.medical_http_request_id',v_request::text,true);
 PERFORM set_config('testdz.medical_http_assignment_id',v_assignment::text,true);

 PERFORM set_config('testdz.feedback_id',v_feedback::text,true);
 PERFORM set_config('testdz.submission_id',v_submission::text,true);
 PERFORM set_config('testdz.submission_storage_path',v_storage_path,true);
 PERFORM set_config('testdz.assignment_id',v_assignment::text,true);
 PERFORM set_config('testdz.test_id',v_test::text,true);
END;
$create_workflow$;

COMMIT;
