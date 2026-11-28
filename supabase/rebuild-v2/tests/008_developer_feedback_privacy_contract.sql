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
 ('80000000-0000-4000-8000-000000000005','authenticated','authenticated','v2-feedback-support@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Support Agent"}'::jsonb,now(),now()),
 ('80000000-0000-4000-8000-000000000006','authenticated','authenticated','v2-feedback-other-tester@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Other Tester"}'::jsonb,now(),now());

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
 PERFORM set_config('testdz.feedback_id',v_feedback::text,true);
 PERFORM set_config('testdz.submission_id',v_submission::text,true);
 PERFORM set_config('testdz.submission_storage_path',v_storage_path,true);
 PERFORM set_config('testdz.assignment_id',v_assignment::text,true);
 PERFORM set_config('testdz.test_id',v_test::text,true);
END;
$create_workflow$;

-- Insert a synthetic Play opt-in event as the migration-test owner; client roles are read-only.
RESET ROLE;
INSERT INTO rebuild_v2.play_opt_in_events(assignment_id,tester_id,event_type,occurred_at,evidence_url,notes,recorded_by)
VALUES(
 current_setting('testdz.assignment_id')::uuid,
 '80000000-0000-4000-8000-000000000003',
 'opted_in',now(),'https://example.invalid/synthetic-opt-in-proof',
 'Synthetic private Play opt-in event','80000000-0000-4000-8000-000000000003'
) RETURNING id;
SELECT set_config('testdz.play_opt_in_event_id',id::text,true)
FROM rebuild_v2.play_opt_in_events
WHERE assignment_id=current_setting('testdz.assignment_id')::uuid
  AND tester_id='80000000-0000-4000-8000-000000000003'
  AND notes='Synthetic private Play opt-in event';
SET LOCAL ROLE authenticated;

-- Build a synthetic report-evidence record as the trusted migration-test owner.
-- Support must retain access to this evidence while losing submission evidence.
RESET ROLE;
INSERT INTO rebuild_v2.reports
 (id,reporter_id,reported_user_id,assignment_id,report_type,description,status)
VALUES (
 '80000000-0000-4000-8000-000000000101',
 '80000000-0000-4000-8000-000000000003',
 '80000000-0000-4000-8000-000000000001',
 current_setting('testdz.assignment_id')::uuid,
 'other',
 'Synthetic report used to preserve Support access to report evidence.',
 'open'
);
INSERT INTO rebuild_v2.report_attachments
 (report_id,assignment_id,test_id,tester_id,file_id,file_extension,original_filename,storage_path)
VALUES (
 '80000000-0000-4000-8000-000000000101',
 current_setting('testdz.assignment_id')::uuid,
 current_setting('testdz.test_id')::uuid,
 '80000000-0000-4000-8000-000000000003',
 '80000000-0000-4000-8000-000000000102',
 'pdf',
 'support-report-proof.pdf',
 'v2/'||current_setting('testdz.test_id')||'/80000000-0000-4000-8000-000000000003/80000000-0000-4000-8000-000000000101/80000000-0000-4000-8000-000000000102.pdf'
);
SELECT set_config(
 'testdz.report_storage_path',
 'v2/'||current_setting('testdz.test_id')||'/80000000-0000-4000-8000-000000000003/80000000-0000-4000-8000-000000000101/80000000-0000-4000-8000-000000000102.pdf',
 true
);
INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
VALUES
 (
  'test-evidence',
  current_setting('testdz.submission_storage_path'),
  '80000000-0000-4000-8000-000000000003',
  '80000000-0000-4000-8000-000000000003',
  jsonb_build_object('mimetype','image/png','size',1024)
 ),
 (
  'test-evidence',
  current_setting('testdz.report_storage_path'),
  '80000000-0000-4000-8000-000000000003',
  '80000000-0000-4000-8000-000000000003',
  jsonb_build_object('mimetype','application/pdf','size',1024)
 );
SET LOCAL ROLE authenticated;

-- The tester retains access to their own feedback and assignment.
DO $tester_access$
BEGIN
 IF (SELECT count(*) FROM rebuild_v2.feedback WHERE id=current_setting('testdz.feedback_id')::uuid)<>1 THEN
  RAISE EXCEPTION 'FAIL: tester cannot read own feedback';
 END IF;
 IF (SELECT count(*) FROM rebuild_v2.assignments WHERE id=current_setting('testdz.assignment_id')::uuid)<>1 THEN
  RAISE EXCEPTION 'FAIL: tester cannot read own assignment';
 END IF;
 IF (SELECT count(*) FROM rebuild_v2.play_opt_in_events WHERE id=current_setting('testdz.play_opt_in_event_id')::uuid)<>1 THEN
  RAISE EXCEPTION 'FAIL: tester cannot read own Play opt-in event';
 END IF;
END;
$tester_access$;

-- Support handles support tickets, not raw tester assignments, check-in notes or feedback.
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000005',true);
SELECT set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
DO $support_tester_data_boundary$
DECLARE
 v_count integer;
 v_policy record;
 v_report_policy_count integer;
BEGIN
 SELECT count(*) INTO v_count FROM rebuild_v2.assignments WHERE id=current_setting('testdz.assignment_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: Support can read a raw tester assignment'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.checkins WHERE assignment_id=current_setting('testdz.assignment_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: Support can read private tester check-in notes'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.feedback WHERE id=current_setting('testdz.feedback_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: Support can read raw tester feedback'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.play_opt_in_events WHERE id=current_setting('testdz.play_opt_in_event_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: Support can read raw tester Play opt-in activity'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.assignment_submissions WHERE id=current_setting('testdz.submission_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: Support can read raw tester submission'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.assignment_submission_attachments WHERE submission_id=current_setting('testdz.submission_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: Support can read raw tester submission attachment metadata'; END IF;
 IF rebuild_v2_private.can_read_test_evidence(current_setting('testdz.submission_storage_path')) THEN
  RAISE EXCEPTION 'FAIL: Support can read raw tester submission evidence from Storage';
 END IF;
 IF NOT rebuild_v2_private.can_read_test_evidence(current_setting('testdz.report_storage_path')) THEN
  RAISE EXCEPTION 'FAIL: Support lost access to permitted report evidence';
 END IF;
 SELECT count(*) INTO v_count FROM storage.objects
 WHERE bucket_id='test-evidence' AND name=current_setting('testdz.submission_storage_path');
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: Support can download raw submission evidence from Storage'; END IF;
 SELECT count(*) INTO v_count FROM storage.objects
 WHERE bucket_id='test-evidence' AND name=current_setting('testdz.report_storage_path');
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: Support cannot download permitted report evidence from Storage'; END IF;

 -- Emit the complete storage.objects policy catalog so any legacy policy is visible
 -- in the local replay. PostgreSQL combines PERMISSIVE policies with OR semantics.
 FOR v_policy IN
     SELECT policyname, cmd, roles, qual, with_check, permissive
     FROM pg_catalog.pg_policies
     WHERE schemaname='storage' AND tablename='objects'
     ORDER BY policyname
   LOOP
     RAISE NOTICE 'storage.objects policy: name=% command=% roles=% mode=% using=% check=%',
       v_policy.policyname, v_policy.cmd, v_policy.roles, v_policy.permissive,
       v_policy.qual, v_policy.with_check;
   END LOOP;

   SELECT count(*) INTO v_report_policy_count
   FROM pg_catalog.pg_policies
   WHERE schemaname='storage' AND tablename='objects'
     AND policyname='report_evidence_select_v2'
     AND cmd='SELECT'
     AND permissive='PERMISSIVE'
     AND roles @> ARRAY['authenticated']::name[]
     AND qual ILIKE '%test-evidence%';
   IF v_report_policy_count<>1 THEN
     RAISE EXCEPTION 'FAIL: expected exactly one authenticated PERMISSIVE test-evidence SELECT policy named report_evidence_select_v2; found %',
       v_report_policy_count;
   END IF;

   FOR v_policy IN
     SELECT policyname, cmd, roles, qual, with_check, permissive
     FROM pg_catalog.pg_policies
     WHERE schemaname='storage' AND tablename='objects'
       AND cmd IN ('SELECT','ALL')
       AND permissive='PERMISSIVE'
       AND (roles @> ARRAY['authenticated']::name[] OR roles @> ARRAY['public']::name[])
   LOOP
     IF v_policy.qual IS NULL OR v_policy.qual !~* 'bucket_id' THEN
       RAISE EXCEPTION 'FAIL: potentially unscoped PERMISSIVE Storage read policy % applies to authenticated/public; USING=%',
         v_policy.policyname, v_policy.qual;
     END IF;
     IF v_policy.qual ILIKE '%test-evidence%'
        AND v_policy.policyname<>'report_evidence_select_v2' THEN
       RAISE EXCEPTION 'FAIL: unexpected PERMISSIVE Storage read policy % also references test-evidence; USING=%',
         v_policy.policyname, v_policy.qual;
     END IF;
 END LOOP;
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
 SELECT count(*) INTO v_count FROM rebuild_v2.play_opt_in_events WHERE id=current_setting('testdz.play_opt_in_event_id')::uuid;
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: Admin lost Play opt-in oversight access'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.assignment_submissions WHERE id=current_setting('testdz.submission_id')::uuid;
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: Admin lost submission oversight access'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.assignment_submission_attachments WHERE submission_id=current_setting('testdz.submission_id')::uuid;
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: Admin lost submission attachment oversight access'; END IF;
 IF NOT rebuild_v2_private.can_read_test_evidence(current_setting('testdz.submission_storage_path')) THEN
  RAISE EXCEPTION 'FAIL: Admin lost submission evidence access';
 END IF;
 IF NOT rebuild_v2_private.can_read_test_evidence(current_setting('testdz.report_storage_path')) THEN
  RAISE EXCEPTION 'FAIL: Admin lost report evidence access';
 END IF;
 SELECT count(*) INTO v_count FROM storage.objects
 WHERE bucket_id='test-evidence'
   AND name IN (current_setting('testdz.submission_storage_path'),current_setting('testdz.report_storage_path'));
 IF v_count<>2 THEN RAISE EXCEPTION 'FAIL: Admin lost Storage evidence oversight access'; END IF;
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
 SELECT count(*) INTO v_count FROM rebuild_v2.assignment_submissions WHERE id=current_setting('testdz.submission_id')::uuid;
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: owning developer cannot read submission'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.assignment_submission_attachments WHERE submission_id=current_setting('testdz.submission_id')::uuid;
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: owning developer cannot read submission attachment metadata'; END IF;
 IF NOT rebuild_v2_private.can_read_test_evidence(current_setting('testdz.submission_storage_path')) THEN
  RAISE EXCEPTION 'FAIL: owning developer cannot read submission evidence';
 END IF;

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

-- A second tester must not see another tester's developer reply.
SELECT set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000006',true);
SELECT set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
DO $other_tester_reply_isolation$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count
 FROM rebuild_v2.get_tester_feedback_messages()
 WHERE feedback_id=current_setting('testdz.feedback_id')::uuid;
 IF v_count<>0 THEN
  RAISE EXCEPTION 'FAIL: another tester can read a developer reply for someone else feedback';
 END IF;
END;
$other_tester_reply_isolation$;

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
 SELECT count(*) INTO v_count FROM rebuild_v2.assignment_submissions WHERE id=current_setting('testdz.submission_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: other developer can read foreign submission'; END IF;
 SELECT count(*) INTO v_count FROM rebuild_v2.assignment_submission_attachments WHERE submission_id=current_setting('testdz.submission_id')::uuid;
 IF v_count<>0 THEN RAISE EXCEPTION 'FAIL: other developer can read foreign submission attachment metadata'; END IF;
 IF rebuild_v2_private.can_read_test_evidence(current_setting('testdz.submission_storage_path')) THEN
  RAISE EXCEPTION 'FAIL: other developer can read foreign submission evidence';
 END IF;
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
 'auth_users_after_rollback',(SELECT count(*) FROM auth.users WHERE id BETWEEN '80000000-0000-4000-8000-000000000001'::uuid AND '80000000-0000-4000-8000-000000000006'::uuid),
 'feedback_after_rollback',(SELECT count(*) FROM rebuild_v2.feedback WHERE body LIKE 'The app navigation is confusing%'),
 'developer_reviews_after_rollback',(SELECT count(*) FROM rebuild_v2.developer_feedback_reviews WHERE resolution_note='Not my test'),
 'developer_messages_after_rollback',(SELECT count(*) FROM rebuild_v2.developer_feedback_messages WHERE body LIKE 'We are reviewing%'),
 'reports_after_rollback',(SELECT count(*) FROM rebuild_v2.reports WHERE id='80000000-0000-4000-8000-000000000101'),
 'play_opt_in_events_after_rollback',(SELECT count(*) FROM rebuild_v2.play_opt_in_events WHERE notes='Synthetic private Play opt-in event'),
 'report_attachments_after_rollback',(SELECT count(*) FROM rebuild_v2.report_attachments WHERE report_id='80000000-0000-4000-8000-000000000101'),
 'storage_objects_after_rollback',(SELECT count(*) FROM storage.objects
   WHERE bucket_id='test-evidence'
     AND (name LIKE '%/80000000-0000-4000-8000-000000000099.png'
       OR name LIKE '%/80000000-0000-4000-8000-000000000102.pdf'))
) AS rollback_cleanup_check;
