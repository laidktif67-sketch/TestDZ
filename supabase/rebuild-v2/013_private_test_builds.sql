-- Private APK build artifacts for V2 developer tests.
-- APKs are never stored in the public app-icons bucket.
-- Candidate-only: apply to isolated TestDZ-FixLab after 012.

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('test-builds','test-builds',false,52428800,ARRAY['application/vnd.android.package-archive'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS rebuild_v2.test_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL,
  developer_id uuid NOT NULL,
  file_id uuid NOT NULL,
  version_label text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/vnd.android.package-archive',
  size_bytes bigint NOT NULL,
  sha256 text,
  storage_path text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_at timestamptz,
  CONSTRAINT test_builds_test_owner_fkey
    FOREIGN KEY(test_id,developer_id)
    REFERENCES rebuild_v2.tests(id,developer_id) ON DELETE RESTRICT,
  CONSTRAINT test_builds_file_key UNIQUE(test_id,file_id),
  CONSTRAINT test_builds_version_check CHECK(char_length(version_label) BETWEEN 1 AND 64),
  CONSTRAINT test_builds_filename_check CHECK(char_length(original_filename) BETWEEN 5 AND 255 AND original_filename ~* '\\.apk$'),
  CONSTRAINT test_builds_mime_check CHECK(mime_type='application/vnd.android.package-archive'),
  CONSTRAINT test_builds_size_check CHECK(size_bytes BETWEEN 1 AND 52428800),
  CONSTRAINT test_builds_sha256_check CHECK(sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT test_builds_status_check CHECK((status='pending' AND uploaded_at IS NULL) OR (status='uploaded' AND uploaded_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS test_builds_test_created_idx
  ON rebuild_v2.test_builds(test_id,created_at DESC);

ALTER TABLE rebuild_v2.test_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.test_builds FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS test_builds_select_participants_v2 ON rebuild_v2.test_builds;
CREATE POLICY test_builds_select_participants_v2 ON rebuild_v2.test_builds
FOR SELECT TO authenticated
USING (
  developer_id=(SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()),ARRAY['admin','support'])
  OR (
    status='uploaded' AND EXISTS(
      SELECT 1 FROM rebuild_v2.assignments a
      WHERE a.test_id=test_builds.test_id
        AND a.tester_id=(SELECT auth.uid())
        AND a.status IN ('pending','active','completed')
    )
  )
);
REVOKE ALL ON TABLE rebuild_v2.test_builds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE rebuild_v2.test_builds TO authenticated;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_upload_test_build(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_test_id uuid; v_developer_id uuid; v_file_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL
     OR p_object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.apk$' THEN
    RETURN false;
  END IF;
  v_test_id:=split_part(p_object_name,'/',1)::uuid;
  v_developer_id:=split_part(p_object_name,'/',2)::uuid;
  v_file_id:=replace(split_part(p_object_name,'/',3),'.apk','')::uuid;
  RETURN v_developer_id=(SELECT auth.uid()) AND EXISTS(
    SELECT 1 FROM rebuild_v2.test_builds b
    JOIN rebuild_v2.tests t ON t.id=b.test_id AND t.developer_id=b.developer_id
    WHERE b.test_id=v_test_id AND b.developer_id=v_developer_id
      AND b.file_id=v_file_id AND b.storage_path=p_object_name
      AND b.status='pending' AND t.test_type='apk_testing'
      AND t.status IN ('draft','failed','cancelled')
  );
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_read_test_build(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM rebuild_v2.test_builds b
    WHERE b.storage_path=p_object_name AND b.status='uploaded'
      AND (
        b.developer_id=(SELECT auth.uid())
        OR rebuild_v2_private.has_role((SELECT auth.uid()),ARRAY['admin','support'])
        OR EXISTS(
          SELECT 1 FROM rebuild_v2.assignments a
          WHERE a.test_id=b.test_id AND a.tester_id=(SELECT auth.uid())
            AND a.status IN ('pending','active','completed')
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_build(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_test_build(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_build(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_test_build(text) TO authenticated;

DROP POLICY IF EXISTS test_builds_storage_insert_v2 ON storage.objects;
CREATE POLICY test_builds_storage_insert_v2 ON storage.objects
FOR INSERT TO authenticated
WITH CHECK(bucket_id='test-builds' AND rebuild_v2_private.can_upload_test_build(name));
DROP POLICY IF EXISTS test_builds_storage_select_v2 ON storage.objects;
CREATE POLICY test_builds_storage_select_v2 ON storage.objects
FOR SELECT TO authenticated
USING(bucket_id='test-builds' AND rebuild_v2_private.can_read_test_build(name));

CREATE OR REPLACE FUNCTION rebuild_v2_private.register_test_build_impl(
  p_test_id uuid,p_file_id uuid,p_version_label text,p_original_filename text,p_size_bytes bigint,p_sha256 text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid:=auth.uid(); v_test rebuild_v2.tests%ROWTYPE; v_path text; v_existing rebuild_v2.test_builds%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_test_id IS NULL OR p_file_id IS NULL
     OR p_version_label IS NULL OR char_length(btrim(p_version_label)) NOT BETWEEN 1 AND 64
     OR p_original_filename IS NULL OR char_length(p_original_filename) NOT BETWEEN 5 AND 255
     OR p_original_filename !~* '\\.apk$'
     OR p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 52428800
     OR (p_sha256 IS NOT NULL AND p_sha256 !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION 'TEST_BUILD_INPUT_INVALID' USING errcode='22023';
  END IF;
  SELECT * INTO v_test FROM rebuild_v2.tests
  WHERE id=p_test_id AND developer_id=v_user FOR UPDATE;
  IF NOT FOUND OR v_test.test_type<>'apk_testing' OR v_test.status NOT IN ('draft','failed','cancelled') THEN
    RAISE EXCEPTION 'OWNED_EDITABLE_APK_TEST_REQUIRED' USING errcode='42501';
  END IF;
  SELECT * INTO v_existing FROM rebuild_v2.test_builds
  WHERE test_id=p_test_id AND file_id=p_file_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status='pending'
       AND v_existing.version_label=btrim(p_version_label)
       AND v_existing.original_filename=p_original_filename
       AND v_existing.size_bytes=p_size_bytes
       AND v_existing.sha256 IS NOT DISTINCT FROM p_sha256 THEN
      RETURN v_existing.storage_path;
    END IF;
    RAISE EXCEPTION 'TEST_BUILD_ID_ALREADY_USED' USING errcode='23505';
  END IF;
  v_path:=p_test_id::text||'/'||v_user::text||'/'||p_file_id::text||'.apk';
  INSERT INTO rebuild_v2.test_builds(test_id,developer_id,file_id,version_label,original_filename,size_bytes,sha256,storage_path)
  VALUES(p_test_id,v_user,p_file_id,btrim(p_version_label),p_original_filename,p_size_bytes,p_sha256,v_path);
  RETURN v_path;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.finalize_test_build_impl(p_build_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid:=auth.uid(); v_build rebuild_v2.test_builds%ROWTYPE; v_size bigint; v_mime text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  SELECT * INTO v_build FROM rebuild_v2.test_builds WHERE id=p_build_id AND developer_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEST_BUILD_NOT_FOUND' USING errcode='42501'; END IF;
  IF v_build.status='uploaded' THEN RETURN true; END IF;
  SELECT NULLIF(o.metadata->>'size','')::bigint,o.metadata->>'mimetype'
  INTO v_size,v_mime
  FROM storage.objects o
  WHERE o.bucket_id='test-builds' AND o.name=v_build.storage_path;
  IF NOT FOUND OR v_size IS DISTINCT FROM v_build.size_bytes
     OR v_mime IS DISTINCT FROM 'application/vnd.android.package-archive' THEN
    RAISE EXCEPTION 'TEST_BUILD_UPLOAD_NOT_VERIFIED' USING errcode='55000';
  END IF;
  UPDATE rebuild_v2.test_builds SET status='uploaded',uploaded_at=now() WHERE id=p_build_id;
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'test.build.uploaded','test',v_build.test_id,'Developer uploaded private APK build',
    jsonb_build_object('build_id',p_build_id,'version',v_build.version_label,'size_bytes',v_build.size_bytes));
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.register_test_build(
  p_test_id uuid,p_file_id uuid,p_version_label text,p_original_filename text,p_size_bytes bigint,p_sha256 text DEFAULT NULL
)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT rebuild_v2_private.register_test_build_impl(p_test_id,p_file_id,p_version_label,p_original_filename,p_size_bytes,p_sha256); $function$;
CREATE OR REPLACE FUNCTION rebuild_v2.finalize_test_build(p_build_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$ SELECT rebuild_v2_private.finalize_test_build_impl(p_build_id); $function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.register_test_build_impl(uuid,uuid,text,text,bigint,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.finalize_test_build_impl(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.register_test_build(uuid,uuid,text,text,bigint,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.finalize_test_build(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.register_test_build_impl(uuid,uuid,text,text,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.finalize_test_build_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.register_test_build(uuid,uuid,text,text,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.finalize_test_build(uuid) TO authenticated;

-- APK tests cannot be submitted for moderation without at least one verified private build.
CREATE OR REPLACE FUNCTION rebuild_v2_private.submit_test_for_review_impl(p_test_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE v_user uuid:=auth.uid(); v_test rebuild_v2.tests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer','admin']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  SELECT * INTO v_test FROM rebuild_v2.tests
  WHERE id=p_test_id AND developer_id=v_user FOR UPDATE;
  IF NOT FOUND OR v_test.status NOT IN ('draft','failed','cancelled') THEN
    RAISE EXCEPTION 'TEST_NOT_FOUND_OR_NOT_SUBMITTABLE' USING errcode='P0002';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM rebuild_v2.apps a WHERE a.id=v_test.app_id AND a.developer_id=v_user AND a.status='published') THEN
    RAISE EXCEPTION 'PUBLISHED_APP_REQUIRED' USING errcode='42501';
  END IF;
  IF v_test.test_type='apk_testing' AND NOT EXISTS(
    SELECT 1 FROM rebuild_v2.test_builds b
    WHERE b.test_id=p_test_id AND b.developer_id=v_user AND b.status='uploaded'
  ) THEN
    RAISE EXCEPTION 'VERIFIED_APK_BUILD_REQUIRED' USING errcode='55000';
  END IF;
  UPDATE rebuild_v2.tests SET status='submitted',updated_at=now() WHERE id=p_test_id;
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'test.submitted','test',p_test_id,'Developer submitted test for review','{}'::jsonb);
END;
$function$;
