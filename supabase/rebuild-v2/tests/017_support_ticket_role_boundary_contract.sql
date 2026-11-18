-- Support ticket read boundary contract. Disposable local database only; all fixtures roll back.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('91700000-0000-4000-8000-000000000001','authenticated','authenticated','v2-support-boundary-agent@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Support Agent"}'::jsonb,now(),now()),
  ('91700000-0000-4000-8000-000000000002','authenticated','authenticated','v2-support-boundary-owner@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Ticket Owner"}'::jsonb,now(),now()),
  ('91700000-0000-4000-8000-000000000003','authenticated','authenticated','v2-support-boundary-other@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Other User"}'::jsonb,now(),now());

-- The auth.users insert trigger provisions the baseline Tester role automatically.
-- Only add the explicit Support role here to avoid duplicating the generated Tester grant.
INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES ('91700000-0000-4000-8000-000000000001','support');

INSERT INTO rebuild_v2.support_tickets
  (id,user_id,requester_role,subject,category,priority,description,status)
VALUES
  ('91700000-0000-4000-8000-000000000101','91700000-0000-4000-8000-000000000002','tester','Cannot submit test','technical','high','A sufficiently detailed ticket description for the support boundary contract.','open'),
  ('91700000-0000-4000-8000-000000000102','91700000-0000-4000-8000-000000000003','developer','Billing question','payments','normal','A sufficiently detailed second ticket description for the support boundary contract.','in_progress');

INSERT INTO rebuild_v2.support_ticket_messages(ticket_id,sender_id,body,internal_note)
VALUES
  ('91700000-0000-4000-8000-000000000101','91700000-0000-4000-8000-000000000002','Customer message for support review.',false),
  ('91700000-0000-4000-8000-000000000101','91700000-0000-4000-8000-000000000001','Internal handling note for authorized support.',true),
  ('91700000-0000-4000-8000-000000000102','91700000-0000-4000-8000-000000000003','Message from a user without the ticket requester role.',false);

-- Seed an internal-note attachment as trusted fixture data. Support may read the
-- conversation row under the current staff policy, but must not read this file
-- or its metadata through either the database or Storage API.
INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
VALUES (
  'support-attachments',
  'v2/91700000-0000-4000-8000-000000000101/91700000-0000-4000-8000-000000000001/91700000-0000-4000-8000-000000000303-internal.pdf',
  '91700000-0000-4000-8000-000000000001'::uuid,
  '91700000-0000-4000-8000-000000000001',
  jsonb_build_object('mimetype','application/pdf','size',1024)
);
INSERT INTO rebuild_v2.support_ticket_attachments
  (ticket_id,message_id,uploaded_by,storage_path,original_filename,mime_type,size_bytes)
SELECT
  '91700000-0000-4000-8000-000000000101',m.id,
  '91700000-0000-4000-8000-000000000001',
  'v2/91700000-0000-4000-8000-000000000101/91700000-0000-4000-8000-000000000001/91700000-0000-4000-8000-000000000303-internal.pdf',
  'internal.pdf','application/pdf',1024
FROM rebuild_v2.support_ticket_messages m
WHERE m.ticket_id='91700000-0000-4000-8000-000000000101'
  AND m.internal_note=true
  AND m.body='Internal handling note for authorized support.';

-- Pre-existing object fixture models an object that could pass a legacy OR-combined
-- Storage policy; the metadata RPC must independently enforce the requester role.
INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
VALUES(
  'support-attachments',
  'v2/91700000-0000-4000-8000-000000000102/91700000-0000-4000-8000-000000000003/91700000-0000-4000-8000-000000000302-proof.pdf',
  '91700000-0000-4000-8000-000000000003'::uuid,
  '91700000-0000-4000-8000-000000000003',
  jsonb_build_object('mimetype','application/pdf','size',1024)
);

INSERT INTO rebuild_v2.payments(id,user_id,amount_dzd,currency,status,idempotency_key)
VALUES ('91700000-0000-4000-8000-000000000201','91700000-0000-4000-8000-000000000002',1200,'DZD','pending','support-boundary-payment-001');

INSERT INTO rebuild_v2.refunds(id,payment_id,user_id,amount_dzd,reason,refund_method,status)
VALUES ('91700000-0000-4000-8000-000000000202','91700000-0000-4000-8000-000000000201','91700000-0000-4000-8000-000000000002',1200,'Support boundary refund fixture','bank_return','requested');

INSERT INTO rebuild_v2.wallet_ledger(user_id,wallet_type,amount,entry_type,idempotency_key,reason)
VALUES ('91700000-0000-4000-8000-000000000002','earned_points',10,'reward','support-boundary-ledger-001','Support boundary ledger fixture');

SET LOCAL ROLE authenticated;

DO $test$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','91700000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91700000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  -- Support can see tickets belonging to different requesters.
  SELECT count(*) INTO v_count FROM rebuild_v2.support_tickets
  WHERE id IN ('91700000-0000-4000-8000-000000000101','91700000-0000-4000-8000-000000000102');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: Support cannot read the expected staff ticket queue; got %',v_count;
  END IF;

  -- The Support role may read its ticket conversations through the dedicated RLS policy,
  -- but the new queue itself intentionally selects ticket metadata only.
  SELECT count(*) INTO v_count FROM rebuild_v2.support_ticket_messages
  WHERE ticket_id='91700000-0000-4000-8000-000000000101';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: Support cannot read the expected ticket conversation records; got %',v_count;
  END IF;

  -- Direct writes to ticket and conversation tables must remain unavailable to clients.
  IF has_table_privilege('authenticated','rebuild_v2.support_tickets','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.support_tickets','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.support_tickets','DELETE')
     OR has_table_privilege('authenticated','rebuild_v2.support_ticket_messages','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.support_ticket_messages','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.support_ticket_messages','DELETE')
     OR has_table_privilege('authenticated','rebuild_v2.support_ticket_attachments','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.support_ticket_attachments','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.support_ticket_attachments','DELETE') THEN
    RAISE EXCEPTION 'FAIL: authenticated clients have direct Support ticket write privileges';
  END IF;

  -- Support must not gain access to another user's financial records.
  SELECT count(*) INTO v_count FROM rebuild_v2.payments
  WHERE user_id='91700000-0000-4000-8000-000000000002';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: Support can read another user payment'; END IF;

  SELECT count(*) INTO v_count FROM rebuild_v2.refunds
  WHERE user_id='91700000-0000-4000-8000-000000000002';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: Support can read another user refund'; END IF;

  SELECT count(*) INTO v_count FROM rebuild_v2.wallet_ledger
  WHERE user_id='91700000-0000-4000-8000-000000000002';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: Support can read another user wallet ledger'; END IF;
END;
$test$;

DO $attachment_boundary$
DECLARE
  v_message_id uuid;
  v_path text;
  v_internal_path text := 'v2/91700000-0000-4000-8000-000000000101/91700000-0000-4000-8000-000000000001/91700000-0000-4000-8000-000000000303-internal.pdf';
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','91700000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91700000-0000-4000-8000-000000000002","role":"authenticated"}',true);

  SELECT id INTO v_message_id
  FROM rebuild_v2.support_ticket_messages
  WHERE ticket_id='91700000-0000-4000-8000-000000000101'
    AND sender_id='91700000-0000-4000-8000-000000000002'
    AND internal_note=false
  ORDER BY created_at
  LIMIT 1;
  IF v_message_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: support attachment fixture message missing';
  END IF;

  v_path:='v2/91700000-0000-4000-8000-000000000101/91700000-0000-4000-8000-000000000002/91700000-0000-4000-8000-000000000301-proof.pdf';
  IF NOT rebuild_v2_private.can_upload_support_attachment(v_path) THEN
    RAISE EXCEPTION 'FAIL: ticket owner rejected for V2-prefixed support attachment';
  END IF;
  IF rebuild_v2_private.can_upload_support_attachment(
    '91700000-0000-4000-8000-000000000101/91700000-0000-4000-8000-000000000002/91700000-0000-4000-8000-000000000301-proof.pdf'
  ) THEN
    RAISE EXCEPTION 'FAIL: V2 support helper accepted the legacy unprefixed path';
  END IF;

  INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
  VALUES(
    'support-attachments',v_path,
    '91700000-0000-4000-8000-000000000002'::uuid,
    '91700000-0000-4000-8000-000000000002',
    jsonb_build_object('mimetype','application/pdf','size',1024)
  );
  PERFORM rebuild_v2.add_support_attachment(
    '91700000-0000-4000-8000-000000000101',v_message_id,v_path,
    'proof.pdf','application/pdf',1024
  );

  SELECT count(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id='support-attachments' AND name=v_path;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: ticket owner cannot read the registered V2 attachment';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','91700000-0000-4000-8000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91700000-0000-4000-8000-000000000003","role":"authenticated"}',true);
  IF rebuild_v2_private.can_read_support_attachment(v_path)
     OR rebuild_v2_private.can_upload_support_attachment(v_path) THEN
    RAISE EXCEPTION 'FAIL: unrelated user passed V2 support attachment helpers';
  END IF;

  -- Even if a legacy Storage policy allowed the object upload, the metadata RPC
  -- must reject a ticket owner who lacks the ticket's declared requester role.
  BEGIN
    PERFORM rebuild_v2.add_support_attachment(
      '91700000-0000-4000-8000-000000000102',
      (SELECT id FROM rebuild_v2.support_ticket_messages
       WHERE ticket_id='91700000-0000-4000-8000-000000000102'
         AND sender_id='91700000-0000-4000-8000-000000000003'
         AND internal_note=false
       ORDER BY created_at DESC LIMIT 1),
      'v2/91700000-0000-4000-8000-000000000102/91700000-0000-4000-8000-000000000003/91700000-0000-4000-8000-000000000302-proof.pdf',
      'proof.pdf','application/pdf',1024
    );
    RAISE EXCEPTION 'FAIL: attachment metadata RPC accepted requester without required role';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
    VALUES(
      'support-attachments',v_path,
      '91700000-0000-4000-8000-000000000003'::uuid,
      '91700000-0000-4000-8000-000000000003',
      jsonb_build_object('mimetype','application/pdf','size',1024)
    );
    RAISE EXCEPTION 'FAIL: unrelated user inserted a V2 support attachment';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  PERFORM set_config('role','postgres',true);
  SELECT count(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id='support-attachments' AND name=v_path
    AND owner_id='91700000-0000-4000-8000-000000000002';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: denied outsider upload changed the existing V2 support attachment';
  END IF;

  -- Staff may read public-message attachment metadata and bytes, but internal-note
  -- attachments are denied even when the staff member can read the conversation.
  PERFORM set_config('request.jwt.claim.sub','91700000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"91700000-0000-4000-8000-000000000001","role":"authenticated"}',true);

  IF rebuild_v2_private.can_read_support_attachment_metadata(
    '91700000-0000-4000-8000-000000000101',
    (SELECT id FROM rebuild_v2.support_ticket_messages
     WHERE ticket_id='91700000-0000-4000-8000-000000000101' AND internal_note=true)
  ) THEN
    RAISE EXCEPTION 'FAIL: Support metadata helper allows internal-note attachment';
  END IF;
  IF NOT rebuild_v2_private.can_read_support_attachment_metadata(
    '91700000-0000-4000-8000-000000000101',
    (SELECT id FROM rebuild_v2.support_ticket_messages
     WHERE ticket_id='91700000-0000-4000-8000-000000000101' AND internal_note=false)
  ) THEN
    RAISE EXCEPTION 'FAIL: Support metadata helper denies public-message attachment';
  END IF;

  SELECT count(*) INTO v_count
  FROM rebuild_v2.support_ticket_attachments
  WHERE ticket_id='91700000-0000-4000-8000-000000000101';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: Support can read internal-note attachment metadata; visible count %',v_count;
  END IF;

  IF rebuild_v2_private.can_read_support_attachment(v_internal_path) THEN
    RAISE EXCEPTION 'FAIL: Storage helper allows Support to read an internal-note attachment';
  END IF;
  IF NOT rebuild_v2_private.can_read_support_attachment(v_path) THEN
    RAISE EXCEPTION 'FAIL: Storage helper denies Support access to a public-message attachment';
  END IF;

  SELECT count(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id='support-attachments'
    AND name IN (v_path,v_internal_path);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: Storage RLS exposed an internal-note attachment or hid the public attachment; visible count %',v_count;
  END IF;
  PERFORM set_config('role','authenticated',true);
END;
$attachment_boundary$;

RESET ROLE;
ROLLBACK;
SELECT 'rebuild_v2_support_ticket_role_boundary_contract: PASS' AS result;
