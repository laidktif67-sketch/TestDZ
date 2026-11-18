-- Admin role-request management contract. Disposable local database only; all fixtures roll back.
BEGIN;
INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
('91500000-0000-4000-8000-000000000001','authenticated','authenticated','v2-admin-one@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Admin One"}'::jsonb,now(),now()),
('91500000-0000-4000-8000-000000000002','authenticated','authenticated','v2-applicant@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Applicant"}'::jsonb,now(),now()),
('91500000-0000-4000-8000-000000000003','authenticated','authenticated','v2-admin-two@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Admin Two"}'::jsonb,now(),now());
INSERT INTO rebuild_v2.user_roles(user_id,role) VALUES
('91500000-0000-4000-8000-000000000001','admin'),
('91500000-0000-4000-8000-000000000003','admin');
INSERT INTO rebuild_v2.role_requests(user_id,requested_role,reason)
VALUES('91500000-0000-4000-8000-000000000002','developer','Seeking access to build and publish apps');
SET LOCAL ROLE authenticated;
DO $test$
DECLARE v_id uuid; v_count integer;
BEGIN
 SELECT id INTO v_id FROM rebuild_v2.role_requests WHERE user_id='91500000-0000-4000-8000-000000000002' AND status='pending';
 PERFORM set_config('request.jwt.claim.sub','91500000-0000-4000-8000-000000000002',true);
 PERFORM set_config('request.jwt.claims','{"sub":"91500000-0000-4000-8000-000000000002","role":"authenticated"}',true);
 BEGIN
  SELECT count(*) INTO v_count FROM rebuild_v2.admin_list_pending_role_requests();
  RAISE EXCEPTION 'FAIL: applicant accessed Admin queue';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 BEGIN
  PERFORM rebuild_v2.admin_review_role_request(v_id,'approved','A valid reason for decision');
  RAISE EXCEPTION 'FAIL: applicant reviewed request';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','91500000-0000-4000-8000-000000000001',true);
 PERFORM set_config('request.jwt.claims','{"sub":"91500000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 SELECT count(*) INTO v_count FROM rebuild_v2.admin_list_pending_role_requests() WHERE request_id=v_id;
 IF v_count<>1 THEN RAISE EXCEPTION 'FAIL: Admin queue did not return pending request'; END IF;
 BEGIN
  PERFORM rebuild_v2.admin_review_role_request(v_id,'approved','short');
  RAISE EXCEPTION 'FAIL: short reason accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','91500000-0000-4000-8000-000000000003',true);
 PERFORM set_config('request.jwt.claims','{"sub":"91500000-0000-4000-8000-000000000003","role":"authenticated"}',true);
 PERFORM rebuild_v2.admin_review_role_request(v_id,'approved','Verified portfolio and development experience');
 IF NOT EXISTS(SELECT 1 FROM rebuild_v2.user_roles WHERE user_id='91500000-0000-4000-8000-000000000002' AND role='developer') THEN
  RAISE EXCEPTION 'FAIL: approval did not grant Developer role'; END IF;
 IF NOT EXISTS(SELECT 1 FROM rebuild_v2.audit_events WHERE actor_id='91500000-0000-4000-8000-000000000003' AND action='role_request.approved' AND target_id=v_id AND char_length(reason)>=10) THEN
  RAISE EXCEPTION 'FAIL: approval audit record missing actor/reason'; END IF;
END;
$test$;
RESET ROLE;
ROLLBACK;
SELECT 'rebuild_v2_admin_role_request_management_contract: PASS' AS result;
