-- Contract for secure Developer tester invitations. Disposable local DB only.
BEGIN;

DO $schema_boundary$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='rebuild_v2' AND c.relname='test_invitations'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN RAISE EXCEPTION 'FAIL: invitations table must force RLS'; END IF;

  IF has_table_privilege('authenticated','rebuild_v2.test_invitations','SELECT')
     OR has_table_privilege('authenticated','rebuild_v2.test_invitations','INSERT')
     OR has_table_privilege('authenticated','rebuild_v2.test_invitations','UPDATE')
     OR has_table_privilege('authenticated','rebuild_v2.test_invitations','DELETE')
     OR has_table_privilege('service_role','rebuild_v2.test_invitations','SELECT')
     OR has_table_privilege('service_role','rebuild_v2.test_invitations','INSERT')
     OR has_table_privilege('service_role','rebuild_v2.test_invitations','UPDATE')
     OR has_table_privilege('service_role','rebuild_v2.test_invitations','DELETE') THEN
    RAISE EXCEPTION 'FAIL: direct table access to invitations is available to client or service_role';
  END IF;

  IF has_function_privilege('anon','rebuild_v2.create_test_invitation(uuid,text,bytea,timestamp with time zone,uuid)','EXECUTE')
     OR has_function_privilege('anon','rebuild_v2.list_test_invitations(uuid)','EXECUTE')
     OR has_function_privilege('anon','rebuild_v2.revoke_test_invitation(uuid,text)','EXECUTE')
     OR has_function_privilege('anon','rebuild_v2.redeem_test_invitation(bytea)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anonymous invitation RPC execution is available';
  END IF;

  IF has_function_privilege('anon','rebuild_v2_private.create_test_invitation_impl(uuid,text,bytea,timestamp with time zone,uuid)','EXECUTE')
     OR has_function_privilege('anon','rebuild_v2_private.redeem_test_invitation_impl(bytea)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anonymous private invitation implementation execution is available';
  END IF;
END;
$schema_boundary$;

-- Unique synthetic identities; the Auth trigger creates their profile rows.
INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b62','authenticated','authenticated','invite-owner@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Invitation Owner"}'::jsonb,now(),now()),
  ('a7b2c3d4-5e6f-4789-8a01-2b3c4d5e6f70','authenticated','authenticated','invite-tester@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Invitation Tester"}'::jsonb,now(),now()),
  ('f1e2d3c4-b5a6-4789-8c01-2d3e4f5a6b70','authenticated','authenticated','different-user@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Different User"}'::jsonb,now(),now());

-- The auth-user trigger grants the default Tester role to new accounts.
-- Grant only the additional Developer role to the owner fixture.
INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES ('d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b62','developer');

INSERT INTO rebuild_v2.apps(developer_id,name,package_name,description,category,status)
VALUES (
  'd8c1a4e7-6b2f-4d91-9c83-2a7e5f104b62',
  'Invitation Contract App','com.testdz.invitationcontract',
  'Synthetic app used only inside the rolled-back invitation contract.','tools','published'
);

INSERT INTO rebuild_v2.tests(app_id,developer_id,title,description,status,min_testers,start_date,end_date)
SELECT a.id,'d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b62',
  'Invitation Contract Test','Synthetic invitation contract test','recruiting',1,
  CURRENT_DATE,CURRENT_DATE+7
FROM rebuild_v2.apps a
WHERE a.package_name='com.testdz.invitationcontract';

INSERT INTO rebuild_v2.cohorts(name,capacity,status,created_by,starts_at,ends_at)
VALUES (
  'Invitation Contract Cohort',2,'forming',
  'd8c1a4e7-6b2f-4d91-9c83-2a7e5f104b62',now(),now()+interval '7 days'
);

INSERT INTO rebuild_v2.cohort_tests(cohort_id,test_id,developer_id)
SELECT c.id,t.id,t.developer_id
FROM rebuild_v2.cohorts c
CROSS JOIN rebuild_v2.tests t
WHERE c.name='Invitation Contract Cohort'
  AND t.title='Invitation Contract Test';

SET LOCAL ROLE authenticated;

DO $invitation_runtime$
DECLARE
  v_test uuid;
  v_invitation uuid;
  v_retry uuid;
  v_revoked uuid;
  v_assignment uuid;
  v_count integer;
  v_hash bytea := decode(repeat('ab',32),'hex');
  v_revoked_hash bytea := decode(repeat('cd',32),'hex');
BEGIN
  SELECT id INTO v_test FROM rebuild_v2.tests
  WHERE title='Invitation Contract Test';

  -- Only the owning Developer can create and list invitations.
  PERFORM set_config('request.jwt.claim.sub','d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b62',true);
  PERFORM set_config('request.jwt.claims','{"sub":"d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b62","role":"authenticated"}',true);
  v_invitation := rebuild_v2.create_test_invitation(
    v_test,' INVITE-TESTER@EXAMPLE.INVALID ',v_hash,
    now()+interval '7 days','d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b61'
  );
  v_retry := rebuild_v2.create_test_invitation(
    v_test,'invite-tester@example.invalid',v_hash,
    now()+interval '7 days','d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b61'
  );
  IF v_retry <> v_invitation THEN
    RAISE EXCEPTION 'FAIL: same idempotency request did not return original invitation';
  END IF;

  SELECT count(*) INTO v_count
  FROM rebuild_v2.list_test_invitations(v_test)
  WHERE invitation_id=v_invitation
    AND recipient_email_masked='i***@example.invalid'
    AND status='pending';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: owner list did not return masked invitation details';
  END IF;

  -- Reusing an idempotency key for a different capability must fail closed.
  BEGIN
    PERFORM rebuild_v2.create_test_invitation(
      v_test,'invite-tester@example.invalid',v_revoked_hash,
      now()+interval '7 days','d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b61'
    );
    RAISE EXCEPTION 'FAIL: mismatched idempotency reuse was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- A different confirmed Auth email cannot redeem the invitation.
  PERFORM set_config('request.jwt.claim.sub','f1e2d3c4-b5a6-4789-8c01-2d3e4f5a6b70',true);
  PERFORM set_config('request.jwt.claims','{"sub":"f1e2d3c4-b5a6-4789-8c01-2d3e4f5a6b70","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.redeem_test_invitation(v_hash);
    RAISE EXCEPTION 'FAIL: invitation was redeemed by a different email';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- The intended Tester redeems; the existing join_test_impl performs the
  -- actual cohort/capacity/duplicate checks in the same transaction.
  PERFORM set_config('request.jwt.claim.sub','a7b2c3d4-5e6f-4789-8a01-2b3c4d5e6f70',true);
  PERFORM set_config('request.jwt.claims','{"sub":"a7b2c3d4-5e6f-4789-8a01-2b3c4d5e6f70","role":"authenticated"}',true);
  v_assignment := rebuild_v2.redeem_test_invitation(v_hash);
  IF v_assignment IS NULL OR NOT EXISTS (
    SELECT 1 FROM rebuild_v2.assignments a
    WHERE a.id=v_assignment AND a.test_id=v_test
      AND a.tester_id='a7b2c3d4-5e6f-4789-8a01-2b3c4d5e6f70'
  ) THEN
    RAISE EXCEPTION 'FAIL: valid invitation did not create the expected tester assignment';
  END IF;
  -- Inspect state through the owner-scoped RPC, never by granting direct table reads.
  PERFORM set_config('request.jwt.claim.sub','d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b62',true);
  PERFORM set_config('request.jwt.claims','{"sub":"d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b62","role":"authenticated"}',true);
  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.list_test_invitations(v_test) i
    WHERE i.invitation_id=v_invitation AND i.status='accepted'
  ) THEN
    RAISE EXCEPTION 'FAIL: redeemed invitation was not atomically marked accepted';
  END IF;

  -- A second invitation can be revoked by its owner and cannot be redeemed.
  v_revoked := rebuild_v2.create_test_invitation(
    v_test,'different-user@example.invalid',v_revoked_hash,
    now()+interval '7 days','d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b60'
  );
  PERFORM rebuild_v2.revoke_test_invitation(v_revoked,'Contract test revocation');
  IF NOT EXISTS (
    SELECT 1 FROM rebuild_v2.list_test_invitations(v_test) i
    WHERE i.invitation_id=v_revoked AND i.status='revoked'
  ) THEN
    RAISE EXCEPTION 'FAIL: invitation revocation was not recorded';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','f1e2d3c4-b5a6-4789-8c01-2d3e4f5a6b70',true);
  PERFORM set_config('request.jwt.claims','{"sub":"f1e2d3c4-b5a6-4789-8c01-2d3e4f5a6b70","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.redeem_test_invitation(v_revoked_hash);
    RAISE EXCEPTION 'FAIL: revoked invitation was redeemed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Tester cannot create invitations, even with a syntactically valid request.
  PERFORM set_config('request.jwt.claim.sub','a7b2c3d4-5e6f-4789-8a01-2b3c4d5e6f70',true);
  PERFORM set_config('request.jwt.claims','{"sub":"a7b2c3d4-5e6f-4789-8a01-2b3c4d5e6f70","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.create_test_invitation(
      v_test,'someone@example.invalid',decode(repeat('ef',32),'hex'),
      now()+interval '7 days','d8c1a4e7-6b2f-4d91-9c83-2a7e5f104b59'
    );
    RAISE EXCEPTION 'FAIL: Tester created a Developer invitation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$invitation_runtime$;

RESET ROLE;
ROLLBACK;
SELECT 'rebuild_v2_developer_test_invitations_contract: PASS' AS result;
