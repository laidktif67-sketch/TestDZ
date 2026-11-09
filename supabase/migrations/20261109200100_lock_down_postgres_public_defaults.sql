-- ============================================================
-- Migration: 20261109000100_lock_down_postgres_public_defaults.sql
-- Purpose: Remove broad default grants for future public objects
-- Scope: Objects created by postgres in schema public only.
-- Safety: Does not alter privileges on existing objects.
-- ============================================================

BEGIN;

DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION
      'Expected migration role postgres, got %', current_user;
  END IF;
END;
$preflight$;

-- Tables and views created by postgres in public:
-- authenticated/anon must receive explicit grants per object.
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

-- Sequences created by postgres in public:
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- Functions created by postgres in public:
-- Remove the default EXECUTE grant from PUBLIC and API roles.
ALTER DEFAULT PRIVILEGES
  FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Verify the intended default ACLs are absent.
DO $verification$
DECLARE
  v_bad_grants integer;
BEGIN
  SELECT count(*)
  INTO v_bad_grants
  FROM pg_catalog.pg_default_acl d
  JOIN pg_catalog.pg_namespace n
    ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) acl
  WHERE n.nspname = 'public'
    AND d.defaclrole = 'postgres'::regrole
    AND (
      (
        d.defaclobjtype = 'r'
        AND acl.grantee IN (
          0::oid,
          'anon'::regrole::oid,
          'authenticated'::regrole::oid
        )
        AND acl.privilege_type IN (
          'SELECT', 'INSERT', 'UPDATE', 'DELETE',
          'TRUNCATE', 'REFERENCES', 'TRIGGER'
        )
      )
      OR (
        d.defaclobjtype = 'S'
        AND acl.grantee IN (
          0::oid,
          'anon'::regrole::oid,
          'authenticated'::regrole::oid
        )
        AND acl.privilege_type IN ('USAGE', 'SELECT', 'UPDATE')
      )
      OR (
        d.defaclobjtype = 'f'
        AND acl.grantee IN (
          0::oid,
          'anon'::regrole::oid,
          'authenticated'::regrole::oid
        )
        AND acl.privilege_type = 'EXECUTE'
      )
    );

  IF v_bad_grants <> 0 THEN
    RAISE EXCEPTION
      'Default ACL verification failed: % broad grants remain',
      v_bad_grants;
  END IF;
END;
$verification$;

COMMIT;
