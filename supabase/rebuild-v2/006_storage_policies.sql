-- TestDZ rebuild v2 Storage buckets and object policies.
-- Apply after 001_schema.sql through 005_support_notifications.sql in an isolated test project.
-- Bucket inserts are additive: existing bucket configuration is never overwritten.

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES
  ('avatars','avatars',true,2097152,ARRAY['image/jpeg','image/png','image/webp']),
  ('app-icons','app-icons',true,524288,ARRAY['image/png','image/jpeg']),
  ('developer-feedback-attachments','developer-feedback-attachments',false,10485760,ARRAY['image/png','image/jpeg','image/webp','text/plain','application/pdf','application/zip']),
  ('support-attachments','support-attachments',false,10485760,ARRAY['image/png','image/jpeg','image/webp','text/plain','application/pdf','application/zip']),
  ('test-evidence','test-evidence',false,10485760,ARRAY['image/png','image/jpeg','image/webp','text/plain','application/pdf','application/zip'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_manage_app_icon(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_folders text[];
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL THEN RETURN false; END IF;
  v_folders := storage.foldername(p_object_name);
  IF coalesce(array_length(v_folders,1),0) <> 3
     OR v_folders[1] <> 'v2'
     OR v_folders[2] <> (SELECT auth.uid())::text
     OR v_folders[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM rebuild_v2.apps a
    WHERE a.id=v_folders[3]::uuid AND a.developer_id=(SELECT auth.uid())
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_upload_support_attachment(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_folders text[];
  v_ticket_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL THEN RETURN false; END IF;
  v_folders := storage.foldername(p_object_name);
  IF coalesce(array_length(v_folders,1),0) <> 3
     OR v_folders[1] <> 'v2'
     OR v_folders[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_folders[3] <> (SELECT auth.uid())::text THEN
    RETURN false;
  END IF;
  v_ticket_id := v_folders[2]::uuid;
  RETURN EXISTS (
    SELECT 1 FROM rebuild_v2.support_tickets st
    WHERE st.id=v_ticket_id AND st.status<>'closed'
      AND st.user_id=(SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM rebuild_v2.user_roles ur
        WHERE ur.user_id=(SELECT auth.uid()) AND ur.role=st.requester_role
      )
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_read_support_attachment(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_folders text[];
  v_ticket_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL THEN RETURN false; END IF;
  v_folders := storage.foldername(p_object_name);
  IF coalesce(array_length(v_folders,1),0) <> 3
     OR v_folders[1] <> 'v2'
     OR v_folders[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_folders[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  v_ticket_id := v_folders[2]::uuid;
  RETURN EXISTS (
    SELECT 1
    FROM rebuild_v2.support_ticket_attachments att
    JOIN rebuild_v2.support_ticket_messages m
      ON m.id=att.message_id AND m.ticket_id=att.ticket_id
    JOIN rebuild_v2.support_tickets st ON st.id=att.ticket_id
    WHERE att.storage_path=p_object_name
      AND st.id=v_ticket_id
      AND att.uploaded_by=v_folders[3]::uuid
      AND (
        (st.user_id=(SELECT auth.uid())
          AND m.internal_note=false
          AND EXISTS (
            SELECT 1 FROM rebuild_v2.user_roles ur
            WHERE ur.user_id=(SELECT auth.uid()) AND ur.role=st.requester_role
          ))
        OR rebuild_v2_private.has_role((SELECT auth.uid()),ARRAY['support','admin'])
      )
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_access_developer_feedback_attachment(
  p_object_name text,
  p_for_upload boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_folders text[];
  v_feedback_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL THEN RETURN false; END IF;
  v_folders := storage.foldername(p_object_name);
  IF coalesce(array_length(v_folders,1),0) <> 2
     OR v_folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  IF p_for_upload AND v_folders[2] <> (SELECT auth.uid())::text THEN RETURN false; END IF;
  v_feedback_id := v_folders[1]::uuid;

  IF p_for_upload THEN
    RETURN EXISTS (
      SELECT 1
      FROM rebuild_v2.feedback f
      JOIN rebuild_v2.assignments a ON a.id=f.assignment_id
      JOIN rebuild_v2.tests t ON t.id=a.test_id
      WHERE f.id=v_feedback_id
        AND (f.tester_id=(SELECT auth.uid()) OR t.developer_id=(SELECT auth.uid()))
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM rebuild_v2.developer_feedback_attachments dfa
    JOIN rebuild_v2.feedback f ON f.id=dfa.feedback_id
    JOIN rebuild_v2.assignments a ON a.id=f.assignment_id
    JOIN rebuild_v2.tests t ON t.id=a.test_id
    WHERE dfa.storage_path=p_object_name
      AND f.id=v_feedback_id
      AND (f.tester_id=(SELECT auth.uid()) OR t.developer_id=(SELECT auth.uid()))
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_upload_test_evidence(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_test_id uuid;
  v_tester_id uuid;
  v_report_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL
     OR p_object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|txt|pdf|zip)$' THEN
    RETURN false;
  END IF;
  v_test_id := split_part(p_object_name,'/',1)::uuid;
  v_tester_id := split_part(p_object_name,'/',2)::uuid;
  v_report_id := split_part(p_object_name,'/',3)::uuid;
  RETURN EXISTS (
    SELECT 1
    FROM rebuild_v2.reports r
    JOIN rebuild_v2.assignments a ON a.id=r.assignment_id
    JOIN rebuild_v2.tests t ON t.id=a.test_id
    WHERE r.id=v_report_id
      AND r.reporter_id=(SELECT auth.uid())
      AND a.tester_id=(SELECT auth.uid())
      AND a.tester_id=v_tester_id
      AND a.test_id=v_test_id
      AND a.status='active'
      AND r.status='open'
      AND t.id=v_test_id
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION rebuild_v2_private.can_read_test_evidence(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
SET row_security TO 'off'
AS $function$
DECLARE
  v_test_id uuid;
  v_tester_id uuid;
  v_report_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_object_name IS NULL
     OR p_object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|txt|pdf|zip)$' THEN
    RETURN false;
  END IF;
  v_test_id := split_part(p_object_name,'/',1)::uuid;
  v_tester_id := split_part(p_object_name,'/',2)::uuid;
  v_report_id := split_part(p_object_name,'/',3)::uuid;
  RETURN EXISTS (
    SELECT 1
    FROM rebuild_v2.report_attachments ra
    JOIN rebuild_v2.reports r ON r.id=ra.report_id
    JOIN rebuild_v2.assignments a ON a.id=r.assignment_id
    JOIN rebuild_v2.tests t ON t.id=a.test_id
    WHERE ra.storage_path=p_object_name
      AND ra.report_id=v_report_id
      AND ra.assignment_id=a.id
      AND ra.test_id=v_test_id
      AND ra.tester_id=v_tester_id
      AND r.id=v_report_id
      AND a.tester_id=v_tester_id
      AND a.test_id=v_test_id
      AND (
        r.reporter_id=(SELECT auth.uid())
        OR t.developer_id=(SELECT auth.uid())
        OR rebuild_v2_private.has_role((SELECT auth.uid()),ARRAY['admin'])
      )
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION rebuild_v2_private.can_manage_app_icon(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_support_attachment(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_support_attachment(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_access_developer_feedback_attachment(text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_manage_app_icon(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_support_attachment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_support_attachment(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_access_developer_feedback_attachment(text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_upload_test_evidence(text) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_v2_private.can_read_test_evidence(text) TO authenticated;

-- Avatars: public downloads are provided by the public bucket; listing and writes stay owner-scoped.
CREATE POLICY avatars_owner_select_v2 ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY avatars_owner_insert_v2 ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY avatars_owner_update_v2 ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text)
WITH CHECK (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY avatars_owner_delete_v2 ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);

-- App icons are public-read, but only the owning developer can mutate an icon for their app.
CREATE POLICY app_icons_public_read_v2 ON storage.objects
FOR SELECT TO public
USING (bucket_id='app-icons');
CREATE POLICY app_icons_owner_insert_v2 ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id='app-icons' AND rebuild_v2_private.can_manage_app_icon(name));
CREATE POLICY app_icons_owner_update_v2 ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id='app-icons' AND rebuild_v2_private.can_manage_app_icon(name))
WITH CHECK (bucket_id='app-icons' AND rebuild_v2_private.can_manage_app_icon(name));
CREATE POLICY app_icons_owner_delete_v2 ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id='app-icons' AND rebuild_v2_private.can_manage_app_icon(name));

-- Developer feedback files are private and visible only to the feedback tester and app developer.
CREATE POLICY developer_feedback_storage_insert_v2 ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id='developer-feedback-attachments' AND rebuild_v2_private.can_access_developer_feedback_attachment(name,true));
CREATE POLICY developer_feedback_storage_select_v2 ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id='developer-feedback-attachments' AND rebuild_v2_private.can_access_developer_feedback_attachment(name,false));

-- Support files are private and restricted to the ticket owner/requester role or support/admin staff.
CREATE POLICY support_attachments_insert_v2 ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id='support-attachments' AND rebuild_v2_private.can_upload_support_attachment(name));
CREATE POLICY support_attachments_select_v2 ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id='support-attachments' AND rebuild_v2_private.can_read_support_attachment(name));

-- Test evidence is private; uploads require the reporter's active assignment and reads are participant-scoped.
CREATE POLICY report_evidence_insert_v2 ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id='test-evidence' AND rebuild_v2_private.can_upload_test_evidence(name));
CREATE POLICY report_evidence_select_v2 ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id='test-evidence' AND rebuild_v2_private.can_read_test_evidence(name));
