-- Support attachment reads must be bound to public messages for every role.
-- Disposable local database only; all fixtures are rolled back.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('92800000-0000-4000-8000-000000000001','authenticated','authenticated','support-attachment-requester@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Requester"}'::jsonb,now(),now()),
  ('92800000-0000-4000-8000-000000000002','authenticated','authenticated','support-attachment-agent@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Support"}'::jsonb,now(),now()),
  ('92800000-0000-4000-8000-000000000003','authenticated','authenticated','support-attachment-admin@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Admin"}'::jsonb,now(),now()),
  ('92800000-0000-4000-8000-000000000004','authenticated','authenticated','support-attachment-outsider@example.invalid','',now(),'{ "provider":"email","providers":["email"] }'::jsonb,'{"name":"Outsider"}'::jsonb,now(),now());

-- Auth-user trigger already seeds the default Tester role for requester/outsider.
INSERT INTO rebuild_v2.user_roles(user_id,role) VALUES
  ('92800000-0000-4000-8000-000000000002','support'),
  ('92800000-0000-4000-8000-000000000003','admin');

INSERT INTO rebuild_v2.support_tickets
  (id,user_id,requester_role,subject,category,description,status)
VALUES
  ('92800000-0000-4000-8000-000000000101','92800000-0000-4000-8000-000000000001',
   'tester','Attachment privacy test','technical',
   'Synthetic support ticket for public versus internal attachment visibility.','open');

INSERT INTO rebuild_v2.support_ticket_messages
  (id,ticket_id,sender_id,body,internal_note)
VALUES
  ('92800000-0000-4000-8000-000000000201','92800000-0000-4000-8000-000000000101',
   '92800000-0000-4000-8000-000000000001','Public message attachment',false),
  ('92800000-0000-4000-8000-000000000202','92800000-0000-4000-8000-000000000101',
   '92800000-0000-4000-8000-000000000002','Internal note attachment',true);

INSERT INTO rebuild_v2.support_ticket_attachments
  (id,ticket_id,message_id,uploaded_by,storage_path,original_filename,mime_type,size_bytes)
VALUES
  ('92800000-0000-4000-8000-000000000301','92800000-0000-4000-8000-000000000101',
   '92800000-0000-4000-8000-000000000201','92800000-0000-4000-8000-000000000002',
   'v2/92800000-0000-4000-8000-000000000101/92800000-0000-4000-8000-000000000002/92800000-0000-4000-8000-000000000301.pdf',
   'public-proof.pdf','application/pdf',1024),
  ('92800000-0000-4000-8000-000000000302','92800000-0000-4000-8000-000000000101',
   '92800000-0000-4000-8000-000000000202','92800000-0000-4000-8000-000000000002',
   'v2/92800000-0000-4000-8000-000000000101/92800000-0000-4000-8000-000000000002/92800000-0000-4000-8000-000000000302.pdf',
   'internal-proof.pdf','application/pdf',1024);

INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
VALUES
  ('support-attachments',
   'v2/92800000-0000-4000-8000-000000000101/92800000-0000-4000-8000-000000000002/92800000-0000-4000-8000-000000000301.pdf',
   '92800000-0000-4000-8000-000000000002','92800000-0000-4000-8000-000000000002',
   jsonb_build_object('mimetype','application/pdf','size',1024)),
  ('support-attachments',
   'v2/92800000-0000-4000-8000-000000000101/92800000-0000-4000-8000-000000000002/92800000-0000-4000-8000-000000000302.pdf',
   '92800000-0000-4000-8000-000000000002','92800000-0000-4000-8000-000000000002',
   jsonb_build_object('mimetype','application/pdf','size',1024));

SET LOCAL ROLE authenticated;
DO $privacy_boundaries$
DECLARE
  v_public_path text := 'v2/92800000-0000-4000-8000-000000000101/92800000-0000-4000-8000-000000000002/92800000-0000-4000-8000-000000000301.pdf';
  v_internal_path text := 'v2/92800000-0000-4000-8000-000000000101/92800000-0000-4000-8000-000000000002/92800000-0000-4000-8000-000000000302.pdf';
  v_count integer;
BEGIN
  -- Requester: public message attachment only.
  PERFORM set_config('request.jwt.claim.sub','92800000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92800000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  IF NOT rebuild_v2_private.can_read_support_attachment(v_public_path)
     OR rebuild_v2_private.can_read_support_attachment(v_internal_path) THEN
    RAISE EXCEPTION 'FAIL: requester attachment helper boundary is incorrect';
  END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.support_ticket_attachments;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: requester metadata visibility expected 1 public attachment, got %',v_count; END IF;
  SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id='support-attachments';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: requester Storage visibility expected 1 public object, got %',v_count; END IF;

  -- Support: staff can read public-message attachments, never internal-note attachments.
  PERFORM set_config('request.jwt.claim.sub','92800000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92800000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  IF NOT rebuild_v2_private.can_read_support_attachment(v_public_path)
     OR rebuild_v2_private.can_read_support_attachment(v_internal_path) THEN
    RAISE EXCEPTION 'FAIL: Support attachment helper boundary is incorrect';
  END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.support_ticket_attachments;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Support metadata visibility expected 1 public attachment, got %',v_count; END IF;
  SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id='support-attachments';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Support Storage visibility expected 1 public object, got %',v_count; END IF;

  -- Admin has the same public-message boundary; Admin is not an override for private notes.
  PERFORM set_config('request.jwt.claim.sub','92800000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92800000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  IF NOT rebuild_v2_private.can_read_support_attachment(v_public_path)
     OR rebuild_v2_private.can_read_support_attachment(v_internal_path) THEN
    RAISE EXCEPTION 'FAIL: Admin attachment helper boundary is incorrect';
  END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.support_ticket_attachments;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Admin metadata visibility expected 1 public attachment, got %',v_count; END IF;
  SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id='support-attachments';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: Admin Storage visibility expected 1 public object, got %',v_count; END IF;

  -- Unrelated user: no attachment metadata or object access.
  PERFORM set_config('request.jwt.claim.sub','92800000-0000-4000-8000-000000000004',true);
  PERFORM set_config('request.jwt.claims','{"sub":"92800000-0000-4000-8000-000000000004","role":"authenticated"}',true);
  IF rebuild_v2_private.can_read_support_attachment(v_public_path)
     OR rebuild_v2_private.can_read_support_attachment(v_internal_path) THEN
    RAISE EXCEPTION 'FAIL: unrelated user passed attachment helper boundary';
  END IF;
  SELECT count(*) INTO v_count FROM rebuild_v2.support_ticket_attachments;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: unrelated user can read attachment metadata'; END IF;
  SELECT count(*) INTO v_count FROM storage.objects WHERE bucket_id='support-attachments';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: unrelated user can read attachment objects'; END IF;
END;
$privacy_boundaries$;
RESET ROLE;

ROLLBACK;
SELECT 'rebuild_v2_support_attachment_privacy_contract: PASS' AS result;
