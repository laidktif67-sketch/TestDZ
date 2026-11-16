-- Private developer-supplied media and documents for V2 tests.
-- Candidate-only: apply to isolated TestDZ-FixLab after 014. Never Production before cutover approval.

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES (
  'test-assets','test-assets',false,52428800,
  ARRAY[
    'image/png','image/jpeg','image/webp',
    'video/mp4','video/webm',
    'application/pdf','text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public=false,
    file_size_limit=EXCLUDED.file_size_limit,
    allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS rebuild_v2.test_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL,
  developer_id uuid NOT NULL,
  file_id uuid NOT NULL,
  title text NOT NULL,
  original_filename text NOT NULL,
  file_extension text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_path text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_at timestamptz,
  CONSTRAINT test_assets_test_owner_fkey
    FOREIGN KEY(test_id,developer_id)
    REFERENCES rebuild_v2.tests(id,developer_id) ON DELETE RESTRICT,
  CONSTRAINT test_assets_file_key UNIQUE(test_id,file_id),
  CONSTRAINT test_assets_title_check CHECK(char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT test_assets_filename_check CHECK(char_length(original_filename) BETWEEN 1 AND 255),
  CONSTRAINT test_assets_extension_check CHECK(file_extension IN ('png','jpg','jpeg','webp','mp4','webm','pdf','txt','docx','pptx','xlsx')),
  CONSTRAINT test_assets_mime_check CHECK(
    (file_extension='png' AND mime_type='image/png') OR
    (file_extension IN ('jpg','jpeg') AND mime_type='image/jpeg') OR
    (file_extension='webp' AND mime_type='image/webp') OR
    (file_extension='mp4' AND mime_type='video/mp4') OR
    (file_extension='webm' AND mime_type='video/webm') OR
    (file_extension='pdf' AND mime_type='application/pdf') OR
    (file_extension='txt' AND mime_type='text/plain') OR
    (file_extension='docx' AND mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document') OR
    (file_extension='pptx' AND mime_type='application/vnd.openxmlformats-officedocument.presentationml.presentation') OR
    (file_extension='xlsx' AND mime_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  ),
  CONSTRAINT test_assets_size_check CHECK(size_bytes BETWEEN 1 AND 52428800),
  CONSTRAINT test_assets_status_check CHECK(
    (status='pending' AND uploaded_at IS NULL) OR
    (status='uploaded' AND uploaded_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS test_assets_test_created_idx
  ON rebuild_v2.test_assets(test_id,created_at DESC);

ALTER TABLE rebuild_v2.test_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.test_assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS test_assets_select_participants_v2 ON rebuild_v2.test_assets;
CREATE POLICY test_assets_select_participants_v2 ON rebuild_v2.test_assets
FOR SELECT TO authenticated
USING (
  developer_id=(SELECT auth.uid())
  OR rebuild_v2_private.has_role((SELECT auth.uid()),ARRAY['admin','support'])
  OR (
    status='uploaded' AND EXISTS(
      SELECT 1 FROM rebuild_v2.assignments a
      WHERE a.test_id=test_assets.test_id
        AND a.tester_id=(SELECT auth.uid())
        AND a.status IN ('pending','active','completed')
    )
  )
);
REVOKE ALL ON TABLE rebuild_v2.test_assets FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE rebuild_v2.test_assets TO authenticated;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_upload_test_asset(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
    SELECT 1
    FROM rebuild_v2.test_assets a
    JOIN rebuild_v2.tests t ON t.id=a.test_id AND t.developer_id=a.developer_id
    WHERE a.storage_path=p_object_name
      AND a.developer_id=(SELECT auth.uid())
      AND a.status='pending'
      AND t.status IN ('draft','failed','cancelled')
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_read_test_asset(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM rebuild_v2.test_assets a
    WHERE a.storage_path=p_object_name AND a.status='uploaded'
      AND (
        a.developer_id=(SELECT auth.uid())
        OR rebuild_v2_private.has_role((SELECT auth.uid()),ARRAY['admin','support'])
        OR EXISTS(
          SELECT 1 FROM rebuild_v2.assignments x
          WHERE x.test_id=a.test_id AND x.tester_id=(SELECT auth.uid())
            AND x.status IN ('pending','active','completed')
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_asset(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_test_asset(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_asset(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_test_asset(text) TO authenticated;

DROP POLICY IF EXISTS test_assets_storage_insert_v2 ON storage.objects;
CREATE POLICY test_assets_storage_insert_v2 ON storage.objects
FOR INSERT TO authenticated
WITH CHECK(bucket_id='test-assets' AND rebuild_v2_private.can_upload_test_asset(name));
DROP POLICY IF EXISTS test_assets_storage_select_v2 ON storage.objects;
CREATE POLICY test_assets_storage_select_v2 ON storage.objects
FOR SELECT TO authenticated
USING(bucket_id='test-assets' AND rebuild_v2_private.can_read_test_asset(name));

CREATE OR REPLACE FUNCTION rebuild_v2_private.register_test_asset_impl(
  p_test_id uuid,
  p_file_id uuid,
  p_title text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_test rebuild_v2.tests%ROWTYPE;
  v_extension text;
  v_path text;
  v_count integer;
  v_existing rebuild_v2.test_assets%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  IF NOT rebuild_v2_private.has_role(v_user,ARRAY['developer']) THEN
    RAISE EXCEPTION 'DEVELOPER_ROLE_REQUIRED' USING errcode='42501';
  END IF;
  IF p_test_id IS NULL OR p_file_id IS NULL
     OR p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 120
     OR p_original_filename IS NULL OR char_length(p_original_filename) NOT BETWEEN 1 AND 255
     OR p_size_bytes IS NULL OR p_size_bytes NOT BETWEEN 1 AND 52428800 THEN
    RAISE EXCEPTION 'TEST_ASSET_INPUT_INVALID' USING errcode='22023';
  END IF;

  v_extension:=lower(regexp_replace(p_original_filename,'^.*[.]',''));
  IF NOT (
    (v_extension='png' AND p_mime_type='image/png') OR
    (v_extension IN ('jpg','jpeg') AND p_mime_type='image/jpeg') OR
    (v_extension='webp' AND p_mime_type='image/webp') OR
    (v_extension='mp4' AND p_mime_type='video/mp4') OR
    (v_extension='webm' AND p_mime_type='video/webm') OR
    (v_extension='pdf' AND p_mime_type='application/pdf') OR
    (v_extension='txt' AND p_mime_type='text/plain') OR
    (v_extension='docx' AND p_mime_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document') OR
    (v_extension='pptx' AND p_mime_type='application/vnd.openxmlformats-officedocument.presentationml.presentation') OR
    (v_extension='xlsx' AND p_mime_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  ) THEN
    RAISE EXCEPTION 'TEST_ASSET_TYPE_INVALID' USING errcode='22023';
  END IF;

  SELECT * INTO v_test FROM rebuild_v2.tests
  WHERE id=p_test_id AND developer_id=v_user FOR UPDATE;
  IF NOT FOUND OR v_test.status NOT IN ('draft','failed','cancelled') THEN
    RAISE EXCEPTION 'OWNED_EDITABLE_TEST_REQUIRED' USING errcode='42501';
  END IF;

  SELECT * INTO v_existing FROM rebuild_v2.test_assets
  WHERE test_id=p_test_id AND file_id=p_file_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status='pending'
       AND v_existing.title=btrim(p_title)
       AND v_existing.original_filename=p_original_filename
       AND v_existing.mime_type=p_mime_type
       AND v_existing.size_bytes=p_size_bytes THEN
      RETURN v_existing.storage_path;
    END IF;
    RAISE EXCEPTION 'TEST_ASSET_ID_ALREADY_USED' USING errcode='23505';
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM rebuild_v2.test_assets WHERE test_id=p_test_id;
  IF v_count>=20 THEN RAISE EXCEPTION 'TEST_ASSET_LIMIT_REACHED' USING errcode='22023'; END IF;

  v_path:=p_test_id::text||'/'||v_user::text||'/'||p_file_id::text||'.'||v_extension;
  INSERT INTO rebuild_v2.test_assets(
    test_id,developer_id,file_id,title,original_filename,file_extension,mime_type,size_bytes,storage_path
  ) VALUES (
    p_test_id,v_user,p_file_id,btrim(p_title),p_original_filename,v_extension,p_mime_type,p_size_bytes,v_path
  );
  RETURN v_path;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.finalize_test_asset_impl(p_asset_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_asset rebuild_v2.test_assets%ROWTYPE;
  v_size bigint;
  v_mime text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode='28000'; END IF;
  SELECT * INTO v_asset FROM rebuild_v2.test_assets
  WHERE id=p_asset_id AND developer_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEST_ASSET_NOT_FOUND' USING errcode='42501'; END IF;
  IF v_asset.status='uploaded' THEN RETURN true; END IF;

  SELECT NULLIF(o.metadata->>'size','')::bigint,o.metadata->>'mimetype'
  INTO v_size,v_mime
  FROM storage.objects o
  WHERE o.bucket_id='test-assets' AND o.name=v_asset.storage_path;
  IF NOT FOUND OR v_size IS DISTINCT FROM v_asset.size_bytes
     OR v_mime IS DISTINCT FROM v_asset.mime_type THEN
    RAISE EXCEPTION 'TEST_ASSET_UPLOAD_NOT_VERIFIED' USING errcode='55000';
  END IF;

  UPDATE rebuild_v2.test_assets SET status='uploaded',uploaded_at=now() WHERE id=p_asset_id;
  INSERT INTO rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  VALUES(v_user,'test.asset.uploaded','test',v_asset.test_id,'Developer uploaded private test media',
    jsonb_build_object('asset_id',p_asset_id,'filename',v_asset.original_filename,'mime_type',v_asset.mime_type,'size_bytes',v_asset.size_bytes));
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.register_test_asset(
  p_test_id uuid,p_file_id uuid,p_title text,p_original_filename text,p_mime_type text,p_size_bytes bigint
)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.register_test_asset_impl(
    p_test_id,p_file_id,p_title,p_original_filename,p_mime_type,p_size_bytes
  );
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2.finalize_test_asset(p_asset_id uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT rebuild_v2_private.finalize_test_asset_impl(p_asset_id);
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.register_test_asset_impl(uuid,uuid,text,text,text,bigint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.finalize_test_asset_impl(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.register_test_asset(uuid,uuid,text,text,text,bigint) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION rebuild_v2.finalize_test_asset(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.register_test_asset_impl(uuid,uuid,text,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.finalize_test_asset_impl(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.register_test_asset(uuid,uuid,text,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2.finalize_test_asset(uuid) TO authenticated;
