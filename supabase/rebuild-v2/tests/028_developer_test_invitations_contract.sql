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
     OR has_table_privilege('authenticated','rebuild_v2.test_invitations','DELETE') THEN
    RAISE EXCEPTION 'FAIL: direct client access to invitations table is available';
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

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES
  ('93200000-0000-4000-8000-000000000001','authenticated','authenticated','invite-tester@example.invalid','',now(),
   '{"provider":"email","providers":["email"]}'::jsonb,'{"name":"Invitation Tester"}'::jsonb,now(),now());

INSERT INTO rebuild_v2.user_roles(user_id,role)
VALUES ('93200000-0000-4000-8000-000000000001','tester');

SET LOCAL ROLE authenticated;
DO $tester_cannot_create$
BEGIN
  PERFORM set_config('request.jwt.claim.sub','93200000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"93200000-0000-4000-8000-000000000001","role":"authenticated"}',true);
  BEGIN
    PERFORM rebuild_v2.create_test_invitation(
      '93200000-0000-4000-8000-000000000099',
      'someone@example.invalid',
      decode(repeat('ab',32),'hex'),
      now()+interval '7 days',
      '93200000-0000-4000-8000-000000000098'
    );
    RAISE EXCEPTION 'FAIL: Tester created a Developer invitation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM rebuild_v2.redeem_test_invitation(decode(repeat('cd',32),'hex'));
    RAISE EXCEPTION 'FAIL: unknown invitation token was accepted';
  EXCEPTION WHEN insufficient_privilege OR invalid_parameter_value THEN NULL;
  END;
END;
$tester_cannot_create$;
RESET ROLE;

ROLLBACK;
SELECT 'rebuild_v2_developer_test_invitations_contract: PASS' AS result;
