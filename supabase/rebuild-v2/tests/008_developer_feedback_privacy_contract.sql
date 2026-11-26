-- Developer feedback privacy and ownership contract.
-- Run ONLY against isolated TestDZ-FixLab after all candidate Rebuild V2 SQL migrations.
-- Synthetic users, feedback, review rows, messages and events are rolled back.

BEGIN;
INSERT INTO auth.users
 (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
 ('80000000-0000-4000-8000-000000000001','authenticated','authenticated','v2-feedback-dev@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Feedback Owner"}'::jsonb,now(),now()),
 ('80000000-0000-4000-8000-000000000002','authenticated','authenticated','v2-feedback-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Feedback Admin"}'::jsonb,now(),now()),
 ('80000000-0000-4000-8000-000000000003','authenticated','authenticated','v2-feedback-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Feedback Tester"}'::jsonb,now(),now()),
 ('80000000-0000-4000-8000-000000000004','authenticated','authenticated','v2-feedback-outsider@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Other Developer"}'::jsonb,now(),now()),
 ('80000000-0000-4000-8000-000000000005','authenticated','authenticated','v2-feedback-support@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Support Agent"}'::jsonb,now(),now());

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
 v_feedback uuid;
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
 v_feedback:=rebuild_v2.submit_tester_feedback(
  v_assignment,'usability',
  'The app navigation is confusing and the settings control is difficult to locate during the test.',
  3::smallint
 );
 PERFORM set_config('testdz.feedback_id',v_feedback::text,true);
 PERFORM set_config('testdz.assignment_id',v_assignment::text,true);
 PERFORM set_config('testdz.test_id',v_test::text,true);
END;
$create_workflow$;

-- The tester retains access to their own feedback and assignment.
DO $tester_access$
BEGIN
 IF (SELECT count(*) FROM rebuild_v2.feedback WHERE id=current_setting('testdz.feedback_id')::uuid)<>1 THEN
  RAISE EXCEPTION 'FAIL: tester cannot read own feedback';
 END IF;
 IF (SELECT count(*) FROM rebuild_v2.assignments WHERE id=current_setting('testdz.assignment_id')::uuid)<>1 THEN
  RAISE EXCEPTION 'FAIL: tester cannot read own assignment';
 END IF;
END;
$tester_access$;

-- Support handles support tickets, not raw tester assignments, check-in notes or feedback.
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000005',true);
SELECT set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
DO $support_tester_data_boundary$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count FROM rebuild_v2.assignments WHERE id=current_setting('testdz.assignment_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: Support can read a raw tester assignment'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.checkins WHERE assignment_id=current_setting('testdz.assignment_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: Support can read private tester check-in notes'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.feedback WHERE id=current_setting('testdz.feedback_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: Support can read raw tester feedback'; END IF;
END;
$support_tester_data_boundary$;

-- Admin retains the audited staff access needed for platform oversight.
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
DO $admin_tester_data_access$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count FROM rebuild_v2.assignments WHERE id=current_setting('testdz.assignment_id')::uuid;
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: Admin lost assignment oversight access'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.checkins WHERE assignment_id=current_setting('testdz.assignment_id')::uuid;
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: Admin lost check-in oversight access'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.feedback WHERE id=current_setting('testdz.feedback_id')::uuid;
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: Admin lost feedback oversight access'; END IF;
END;
$admin_tester_data_access$;

-- Developer may see the feedback through a sanitized RPC, but not raw tester records.
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $owner_privacy$
DECLARE v_count integer; v_id uuid;
BEGIN
 SELECT count(*) INTO v_count FROM rebuild_v2.assignments WHERE id=current_setting('testdz.assignment_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: developer can read raw tester assignment'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.checkins WHERE assignment_id=current_setting('testdz.assignment_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: developer can read tester check-ins'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.feedback WHERE id=current_setting('testdz.feedback_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: developer can read raw feedback row'; END IF;

 SELECT count(*) INTO v_count FROM rebuild_v2.get_developer_feedback()
 WHERE feedback_id=current_setting('testdz.feedback_id')::uuid
   AND test_id=current_setting('testdz.test_id')::uuid
   AND body LIKE 'The app navigation is confusing%'
   AND review_status='new' AND priority='normal';
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: owner sanitized feedback RPC did not return owned feedback'; END IF;

 IF has_table_privilege('authenticated','rebuild_v2.developer_feedback_messages','SELECT')
    OR has_table_privilege('authenticated','rebuild_v2.developer_feedback_reviews','SELECT')
    OR has_table_privilege('authenticated','rebuild_v2.developer_feedback_events','SELECT') THEN
  RAISE EXCEPTION 'FAIL: developer feedback workflow tables remain directly readable';
 END IF;

 v_id:=rebuild_v2.update_developer_feedback_review(
  current_setting('testdz.feedback_id')::uuid,'under_review','high',NULL
 );
 IF v_id IS NULL THEN RAISE EXCEPTION 'FAIL: owner review update returned no id'; END IF;
 PERFORM rebuild_v2.send_developer_feedback_message(
  current_setting('testdz.feedback_id')::uuid,'We are reviewing the navigation issue for the next release.'
 );
 IF NOT EXISTS(
  SELECT 1 FROM rebuild_v2.get_developer_feedback_messages(current_setting('testdz.feedback_id')::uuid)
  WHERE sender_label='You' AND body LIKE 'We are reviewing%'
 ) THEN RAISE EXCEPTION 'FAIL: sanitized developer message RPC did not return the new message'; END IF;

 BEGIN
  PERFORM rebuild_v2.update_developer_feedback_review(
   current_setting('testdz.feedback_id')::uuid,'resolved','high',NULL
  );
  RAISE EXCEPTION 'FAIL: resolved status accepted without a resolution note';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
 END;
END;
$owner_privacy$;

-- The tester can read only developer-authored replies to their own feedback.
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
DO $tester_reply_access$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count
 FROM rebuild_v2.get_tester_feedback_messages()
 WHERE feedback_id=current_setting('testdz.feedback_id')::uuid
   AND body='We are reviewing the navigation issue for the next release.';
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: tester cannot read developer reply for own feedback'; END IF;
END;
$tester_reply_access$;

-- A different developer cannot use the tester-only reply RPC.
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000004',true);
SELECT set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
DO $outsider_tester_reply_boundary$
DECLARE v_count integer;
BEGIN
 BEGIN
  SELECT count(*) INTO v_count FROM rebuild_v2.get_tester_feedback_messages();
  RAISE EXCEPTION 'FAIL: non-tester role accessed tester feedback replies';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END;
$outsider_tester_reply_boundary$;

-- A different developer sees no rows and cannot update or message this feedback.
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000004',true);
SELECT set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
DO $outsider_privacy$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count FROM rebuild_v2.get_developer_feedback();
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: other developer can see foreign test feedback'; END IF;
 BEGIN
  PERFORM rebuild_v2.update_developer_feedback_review(
   current_setting('testdz.feedback_id')::uuid,'resolved','normal','Not my test'
  );
  RAISE EXCEPTION 'FAIL: other developer updated foreign feedback';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
 BEGIN
  PERFORM rebuild_v2.send_developer_feedback_message(
   current_setting('testdz.feedback_id')::uuid,'Unauthorized message'
  );
  RAISE EXCEPTION 'FAIL: other developer messaged foreign feedback';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END;
$outsider_privacy$;

RESET ROLE;
ROLLBACK;

SELECT jsonb_build_object(
 'auth_users_after_rollback',(SELECT count(*) FROM auth.users WHERE id BETWEEN '80000000-0000-4000-8000-000000000001'::uuid AND '80000000-0000-4000-8000-000000000005'::uuid),
 'feedback_after_rollback',(SELECT count(*) FROM rebuild_v2.feedback WHERE body LIKE 'The app navigation is confusing%'),
 'developer_reviews_after_rollback',(SELECT count(*) FROM rebuild_v2.developer_feedback_reviews WHERE resolution_note='Not my test'),
 'developer_messages_after_rollback',(SELECT count(*) FROM rebuild_v2.developer_feedback_messages WHERE body LIKE 'We are reviewing%')
) AS rollback_cleanup_check;
