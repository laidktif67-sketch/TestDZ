-- TestDZ rebuild v2 candidate security baseline.
-- Includes role helpers, safe signup bootstrap, audited wallet posting, RLS policies and triggers.
-- Not a production migration. Apply only after 001_schema.sql to a clean test database.

CREATE OR REPLACE FUNCTION rebuild_v2_private.prevent_immutable_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  raise exception 'immutable_record: updates and deletes are not allowed';
end;
$function$;


CREATE OR REPLACE FUNCTION rebuild_v2_private.has_role(p_user_id uuid, p_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'rebuild_v2'
 SET row_security TO 'off'
AS $function$
  select p_user_id is not null
     and p_user_id = auth.uid()
     and exists (
       select 1 from rebuild_v2.user_roles ur
       where ur.user_id = p_user_id and ur.role = any(p_roles)
     );
$function$;


CREATE OR REPLACE FUNCTION rebuild_v2_private.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'rebuild_v2'
 SET row_security TO 'off'
AS $function$
begin
  insert into rebuild_v2.profiles(id,display_name,avatar_url)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),120),''),
    nullif(new.raw_user_meta_data->>'avatar_url','')
  )
  on conflict (id) do nothing;

  insert into rebuild_v2.user_roles(user_id,role)
  values (new.id,'tester')
  on conflict (user_id,role) do nothing;

  insert into rebuild_v2.wallets(user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION rebuild_v2_private.grant_role(p_user_id uuid, p_role text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private'
 SET row_security TO 'off'
AS $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or not rebuild_v2_private.has_role(v_actor,array['admin']) then
    raise exception 'forbidden: admin role required' using errcode='42501';
  end if;
  if p_user_id is null or p_role is null or p_role not in ('tester','developer','financial','support') then
    raise exception 'invalid role assignment';
  end if;
  if p_reason is null or char_length(btrim(p_reason))<10 or char_length(p_reason)>1000 then
    raise exception 'a reason between 10 and 1000 characters is required';
  end if;
  if not exists(select 1 from rebuild_v2.profiles where id=p_user_id) then
    raise exception 'target profile does not exist';
  end if;
  insert into rebuild_v2.user_roles(user_id,role,granted_by)
  values(p_user_id,p_role,v_actor)
  on conflict(user_id,role) do nothing;
  insert into rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  values(v_actor,'role.grant','user',p_user_id,p_reason,jsonb_build_object('role',p_role));
end;
$function$;


CREATE OR REPLACE FUNCTION rebuild_v2_private.post_wallet_entry(p_user_id uuid, p_wallet_type text, p_amount bigint, p_entry_type text, p_idempotency_key text, p_reason text, p_reference_type text DEFAULT NULL::text, p_reference_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private'
 SET row_security TO 'off'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_entry_id uuid;
  v_existing rebuild_v2.wallet_ledger%rowtype;
  v_current bigint;
begin
  if v_actor is null or not rebuild_v2_private.has_role(v_actor,array['admin','financial']) then
    raise exception 'forbidden: financial role required' using errcode='42501';
  end if;
  if p_user_id is null or p_wallet_type is null or p_wallet_type not in ('earned_points','purchased_credits')
     or p_amount is null or p_amount=0
     or p_entry_type is null or p_entry_type not in ('reward','purchase','refund','adjustment','reversal','payout') then
    raise exception 'invalid wallet entry';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 10 and 160 then
    raise exception 'invalid idempotency key';
  end if;
  if p_reason is null or char_length(btrim(p_reason))<10 or char_length(p_reason)>1000 then
    raise exception 'a reason between 10 and 1000 characters is required';
  end if;
  if not exists(select 1 from rebuild_v2.profiles where id=p_user_id) then
    raise exception 'target profile does not exist';
  end if;

  select * into v_existing from rebuild_v2.wallet_ledger where idempotency_key=p_idempotency_key;
  if found then
    if v_existing.user_id IS DISTINCT FROM p_user_id
       or v_existing.wallet_type IS DISTINCT FROM p_wallet_type
       or v_existing.amount IS DISTINCT FROM p_amount
       or v_existing.entry_type IS DISTINCT FROM p_entry_type
       or v_existing.reference_type IS DISTINCT FROM p_reference_type
       or v_existing.reference_id IS DISTINCT FROM p_reference_id
       or v_existing.actor_id IS DISTINCT FROM v_actor
       or v_existing.reason IS DISTINCT FROM p_reason then
      raise exception 'idempotency key already used for a different operation';
    end if;
    return v_existing.id;
  end if;

  insert into rebuild_v2.wallets(user_id) values(p_user_id) on conflict(user_id) do nothing;
  select case when p_wallet_type='earned_points' then earned_points else purchased_credits end
  into v_current from rebuild_v2.wallets where user_id=p_user_id for update;
  if v_current+p_amount<0 then raise exception 'insufficient wallet balance'; end if;

  insert into rebuild_v2.wallet_ledger(
    user_id,wallet_type,amount,entry_type,reference_type,reference_id,idempotency_key,actor_id,reason
  ) values (
    p_user_id,p_wallet_type,p_amount,p_entry_type,p_reference_type,p_reference_id,p_idempotency_key,v_actor,p_reason
  ) on conflict(idempotency_key) do nothing returning id into v_entry_id;

  if v_entry_id is null then
    select * into v_existing from rebuild_v2.wallet_ledger where idempotency_key=p_idempotency_key;
    if v_existing.user_id IS DISTINCT FROM p_user_id
       or v_existing.wallet_type IS DISTINCT FROM p_wallet_type
       or v_existing.amount IS DISTINCT FROM p_amount
       or v_existing.entry_type IS DISTINCT FROM p_entry_type
       or v_existing.reference_type IS DISTINCT FROM p_reference_type
       or v_existing.reference_id IS DISTINCT FROM p_reference_id
       or v_existing.actor_id IS DISTINCT FROM v_actor
       or v_existing.reason IS DISTINCT FROM p_reason then
      raise exception 'idempotency key already used for a different operation';
    end if;
    return v_existing.id;
  end if;

  if p_wallet_type='earned_points' then
    update rebuild_v2.wallets set earned_points=earned_points+p_amount,updated_at=now() where user_id=p_user_id;
  else
    update rebuild_v2.wallets set purchased_credits=purchased_credits+p_amount,updated_at=now() where user_id=p_user_id;
  end if;

  insert into rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,request_id,metadata)
  values(v_actor,'wallet.entry.posted','wallet',p_user_id,p_reason,p_idempotency_key,
    jsonb_build_object('entry_id',v_entry_id,'wallet_type',p_wallet_type,'amount',p_amount,'entry_type',p_entry_type));
  return v_entry_id;
end;
$function$;


CREATE OR REPLACE FUNCTION rebuild_v2_private.request_developer_role(p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private'
 SET row_security TO 'off'
AS $function$
declare v_actor uuid := auth.uid(); v_request_id uuid;
begin
  if v_actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if rebuild_v2_private.has_role(v_actor,array['developer']) then
    raise exception 'developer role already assigned';
  end if;
  if p_reason is not null and char_length(p_reason)>2000 then raise exception 'reason too long'; end if;

  insert into rebuild_v2.role_requests(user_id,requested_role,reason)
  values(v_actor,'developer',p_reason)
  on conflict (user_id) where status='pending' do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select id into v_request_id from rebuild_v2.role_requests where user_id=v_actor and status='pending';
  end if;
  return v_request_id;
end;
$function$;


CREATE OR REPLACE FUNCTION rebuild_v2_private.review_role_request(p_request_id uuid, p_decision text, p_review_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'rebuild_v2', 'rebuild_v2_private'
 SET row_security TO 'off'
AS $function$
declare v_actor uuid := auth.uid(); v_req rebuild_v2.role_requests%rowtype;
begin
  if v_actor is null or not rebuild_v2_private.has_role(v_actor,array['admin']) then
    raise exception 'forbidden: admin role required' using errcode='42501';
  end if;
  if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'invalid decision'; end if;
  if p_review_note is not null and char_length(p_review_note)>2000 then raise exception 'review note too long'; end if;

  select * into v_req from rebuild_v2.role_requests where id=p_request_id for update;
  if not found or v_req.status<>'pending' then raise exception 'pending role request not found'; end if;

  update rebuild_v2.role_requests
  set status=p_decision,reviewed_by=v_actor,reviewed_at=now(),review_note=p_review_note
  where id=p_request_id;

  if p_decision='approved' then
    insert into rebuild_v2.user_roles(user_id,role,granted_by)
    values(v_req.user_id,'developer',v_actor)
    on conflict(user_id,role) do nothing;
  end if;

  insert into rebuild_v2.audit_events(actor_id,action,target_type,target_id,reason,metadata)
  values(v_actor,'role_request.'||p_decision,'role_request',p_request_id,
    coalesce(p_review_note,'Role request decision'),
    jsonb_build_object('user_id',v_req.user_id,'requested_role',v_req.requested_role));
end;
$function$;


CREATE TRIGGER audit_events_immutable_v2 BEFORE DELETE OR UPDATE ON rebuild_v2.audit_events FOR EACH ROW EXECUTE FUNCTION rebuild_v2_private.prevent_immutable_mutation();

CREATE TRIGGER developer_feedback_events_immutable_v2 BEFORE DELETE OR UPDATE ON rebuild_v2.developer_feedback_events FOR EACH ROW EXECUTE FUNCTION rebuild_v2_private.prevent_immutable_mutation();

CREATE TRIGGER fraud_events_immutable_v2 BEFORE DELETE OR UPDATE ON rebuild_v2.fraud_events FOR EACH ROW EXECUTE FUNCTION rebuild_v2_private.prevent_immutable_mutation();

CREATE TRIGGER play_opt_in_events_immutable_v2 BEFORE DELETE OR UPDATE ON rebuild_v2.play_opt_in_events FOR EACH ROW EXECUTE FUNCTION rebuild_v2_private.prevent_immutable_mutation();

CREATE TRIGGER support_ticket_events_immutable_v2 BEFORE DELETE OR UPDATE ON rebuild_v2.support_ticket_events FOR EACH ROW EXECUTE FUNCTION rebuild_v2_private.prevent_immutable_mutation();

CREATE TRIGGER wallet_ledger_immutable_v2 BEFORE DELETE OR UPDATE ON rebuild_v2.wallet_ledger FOR EACH ROW EXECUTE FUNCTION rebuild_v2_private.prevent_immutable_mutation();

CREATE TRIGGER rebuild_v2_on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION rebuild_v2_private.handle_new_auth_user();

CREATE POLICY apps_select_published_owner_admin_v2 ON rebuild_v2.apps AS PERMISSIVE FOR SELECT TO authenticated USING (((status = 'published'::text) OR (developer_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY assignments_select_participants_v2 ON rebuild_v2.assignments AS PERMISSIVE FOR SELECT TO authenticated USING (((tester_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text]) OR (EXISTS ( SELECT 1
   FROM rebuild_v2.tests t
  WHERE ((t.id = assignments.test_id) AND (t.developer_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY audit_events_select_admin_v2 ON rebuild_v2.audit_events AS PERMISSIVE FOR SELECT TO authenticated USING (rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text]));

CREATE POLICY checkins_select_participants_v2 ON rebuild_v2.checkins AS PERMISSIVE FOR SELECT TO authenticated USING (((tester_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text]) OR (EXISTS ( SELECT 1
   FROM (rebuild_v2.assignments a
     JOIN rebuild_v2.tests t ON ((t.id = a.test_id)))
  WHERE ((a.id = checkins.assignment_id) AND (t.developer_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY cohort_tests_select_participants_v2 ON rebuild_v2.cohort_tests AS PERMISSIVE FOR SELECT TO authenticated USING (((developer_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text]) OR (EXISTS ( SELECT 1
   FROM rebuild_v2.assignments a
  WHERE ((a.cohort_id = cohort_tests.cohort_id) AND (a.test_id = cohort_tests.test_id) AND (a.tester_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY cohorts_select_participants_v2 ON rebuild_v2.cohorts AS PERMISSIVE FOR SELECT TO authenticated USING (((created_by = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text]) OR (EXISTS ( SELECT 1
   FROM rebuild_v2.assignments a
  WHERE ((a.cohort_id = a.id) AND (a.tester_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM rebuild_v2.cohort_tests ct
  WHERE ((ct.cohort_id = cohorts.id) AND (ct.developer_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY coupon_redemptions_select_owner_financial_admin_v2 ON rebuild_v2.coupon_redemptions AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'financial'::text])));

CREATE POLICY coupon_select_active_financial_admin_v2 ON rebuild_v2.coupons AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'financial'::text])));

CREATE POLICY developer_feedback_attachments_select_participants_v2 ON rebuild_v2.developer_feedback_attachments AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM ((rebuild_v2.feedback f
     JOIN rebuild_v2.assignments a ON ((a.id = f.assignment_id)))
     JOIN rebuild_v2.tests t ON ((t.id = a.test_id)))
  WHERE ((f.id = developer_feedback_attachments.feedback_id) AND ((f.tester_id = ( SELECT auth.uid() AS uid)) OR (t.developer_id = ( SELECT auth.uid() AS uid)))))) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY developer_feedback_events_select_participants_v2 ON rebuild_v2.developer_feedback_events AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM ((rebuild_v2.feedback f
     JOIN rebuild_v2.assignments a ON ((a.id = f.assignment_id)))
     JOIN rebuild_v2.tests t ON ((t.id = a.test_id)))
  WHERE ((f.id = developer_feedback_events.feedback_id) AND ((f.tester_id = ( SELECT auth.uid() AS uid)) OR (t.developer_id = ( SELECT auth.uid() AS uid)))))) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY developer_feedback_messages_select_participants_v2 ON rebuild_v2.developer_feedback_messages AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM ((rebuild_v2.feedback f
     JOIN rebuild_v2.assignments a ON ((a.id = f.assignment_id)))
     JOIN rebuild_v2.tests t ON ((t.id = a.test_id)))
  WHERE ((f.id = developer_feedback_messages.feedback_id) AND ((f.tester_id = ( SELECT auth.uid() AS uid)) OR (t.developer_id = ( SELECT auth.uid() AS uid)))))) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY developer_feedback_reviews_select_participants_v2 ON rebuild_v2.developer_feedback_reviews AS PERMISSIVE FOR SELECT TO authenticated USING (((developer_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY devices_select_owner_admin_v2 ON rebuild_v2.devices AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text])));

CREATE POLICY disputes_select_participants_staff_v2 ON rebuild_v2.disputes AS PERMISSIVE FOR SELECT TO authenticated USING (((opened_by = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'financial'::text, 'support'::text])));

CREATE POLICY events_select_admin_v2 ON rebuild_v2.events AS PERMISSIVE FOR SELECT TO authenticated USING (rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text]));

CREATE POLICY feature_usage_select_owner_admin_v2 ON rebuild_v2.feature_usage AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text])));

CREATE POLICY feedback_select_participants_v2 ON rebuild_v2.feedback AS PERMISSIVE FOR SELECT TO authenticated USING (((tester_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text]) OR (EXISTS ( SELECT 1
   FROM (rebuild_v2.assignments a
     JOIN rebuild_v2.tests t ON ((t.id = a.test_id)))
  WHERE ((a.id = feedback.assignment_id) AND (t.developer_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY fraud_events_select_admin_v2 ON rebuild_v2.fraud_events AS PERMISSIVE FOR SELECT TO authenticated USING (rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text]));

CREATE POLICY fraud_reviews_select_admin_support_v2 ON rebuild_v2.fraud_reviews AS PERMISSIVE FOR SELECT TO authenticated USING (rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text]));

CREATE POLICY ledger_select_owner_financial_admin_v2 ON rebuild_v2.wallet_ledger AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'financial'::text])));

CREATE POLICY medical_requests_select_tester_admin_v2 ON rebuild_v2.medical_exception_requests AS PERMISSIVE FOR SELECT TO authenticated USING (((tester_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text])));

CREATE POLICY notifications_select_owner_v2 ON rebuild_v2.notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY payments_select_owner_financial_admin_v2 ON rebuild_v2.payments AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'financial'::text])));

CREATE POLICY plans_select_active_or_financial_v2 ON rebuild_v2.plans AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'financial'::text])));

CREATE POLICY platform_config_select_admin_v2 ON rebuild_v2.platform_config AS PERMISSIVE FOR SELECT TO authenticated USING (rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text]));

CREATE POLICY play_opt_in_select_participants_v2 ON rebuild_v2.play_opt_in_events AS PERMISSIVE FOR SELECT TO authenticated USING (((tester_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text]) OR (EXISTS ( SELECT 1
   FROM (rebuild_v2.assignments a
     JOIN rebuild_v2.tests t ON ((t.id = a.test_id)))
  WHERE ((a.id = play_opt_in_events.assignment_id) AND (t.developer_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY profiles_select_self_or_admin_v2 ON rebuild_v2.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text])));

CREATE POLICY profiles_update_self_v2 ON rebuild_v2.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY referrals_select_participants_admin_v2 ON rebuild_v2.referrals AS PERMISSIVE FOR SELECT TO authenticated USING (((referrer_id = ( SELECT auth.uid() AS uid)) OR (referred_user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text])));

CREATE POLICY refunds_select_owner_financial_admin_v2 ON rebuild_v2.refunds AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'financial'::text])));

CREATE POLICY report_attachments_select_report_participants_v2 ON rebuild_v2.report_attachments AS PERMISSIVE FOR SELECT TO authenticated USING (((tester_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text]) OR (EXISTS ( SELECT 1
   FROM rebuild_v2.reports r
  WHERE ((r.id = report_attachments.report_id) AND (r.reporter_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY reports_select_reporter_staff_v2 ON rebuild_v2.reports AS PERMISSIVE FOR SELECT TO authenticated USING (((reporter_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY role_requests_select_owner_admin_v2 ON rebuild_v2.role_requests AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text])));

CREATE POLICY roles_select_self_or_admin_v2 ON rebuild_v2.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text])));

CREATE POLICY subscriptions_select_owner_admin_v2 ON rebuild_v2.subscriptions AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'financial'::text])));

CREATE POLICY support_attachments_select_ticket_participants_v2 ON rebuild_v2.support_ticket_attachments AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM (rebuild_v2.support_ticket_messages m
     JOIN rebuild_v2.support_tickets st ON ((st.id = m.ticket_id)))
  WHERE ((m.id = support_ticket_attachments.message_id) AND (st.id = support_ticket_attachments.ticket_id) AND (st.user_id = ( SELECT auth.uid() AS uid)) AND (m.internal_note = false)))) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY support_events_select_ticket_participants_v2 ON rebuild_v2.support_ticket_events AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM rebuild_v2.support_tickets st
  WHERE ((st.id = support_ticket_events.ticket_id) AND (st.user_id = ( SELECT auth.uid() AS uid))))) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY support_messages_select_ticket_participants_v2 ON rebuild_v2.support_ticket_messages AS PERMISSIVE FOR SELECT TO authenticated USING ((((internal_note = false) AND (EXISTS ( SELECT 1
   FROM rebuild_v2.support_tickets st
  WHERE ((st.id = support_ticket_messages.ticket_id) AND (st.user_id = ( SELECT auth.uid() AS uid)))))) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY support_tickets_select_owner_staff_v2 ON rebuild_v2.support_tickets AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY test_media_select_test_participants_v2 ON rebuild_v2.test_media AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM rebuild_v2.tests t
  WHERE ((t.id = test_media.test_id) AND ((t.status = ANY (ARRAY['recruiting'::text, 'ready'::text, 'running'::text])) OR (t.developer_id = ( SELECT auth.uid() AS uid)))))) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY test_requirements_select_test_participants_v2 ON rebuild_v2.test_requirements AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM rebuild_v2.tests t
  WHERE ((t.id = test_requirements.test_id) AND ((t.status = ANY (ARRAY['recruiting'::text, 'ready'::text, 'running'::text])) OR (t.developer_id = ( SELECT auth.uid() AS uid)))))) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY test_steps_select_test_participants_v2 ON rebuild_v2.test_steps AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM rebuild_v2.tests t
  WHERE ((t.id = test_steps.test_id) AND ((t.status = ANY (ARRAY['recruiting'::text, 'ready'::text, 'running'::text])) OR (t.developer_id = ( SELECT auth.uid() AS uid)))))) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY tests_select_published_owner_admin_v2 ON rebuild_v2.tests AS PERMISSIVE FOR SELECT TO authenticated USING (((status = ANY (ARRAY['recruiting'::text, 'ready'::text, 'running'::text])) OR (developer_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'support'::text])));

CREATE POLICY wallets_select_owner_financial_admin_v2 ON rebuild_v2.wallets AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR rebuild_v2_private.has_role(( SELECT auth.uid() AS uid), ARRAY['admin'::text, 'financial'::text])));

-- Privileges: deny direct client writes; expose only safe reads and explicitly scoped RPCs.
revoke all on all tables in schema rebuild_v2 from public, anon, authenticated;
grant select on all tables in schema rebuild_v2 to authenticated;
grant update(display_name,avatar_url,bio,locale,phone,interests)
  on rebuild_v2.profiles to authenticated;

revoke all on function rebuild_v2_private.prevent_immutable_mutation() from public,anon,authenticated;
revoke all on function rebuild_v2_private.handle_new_auth_user() from public,anon,authenticated;
revoke all on function rebuild_v2_private.has_role(uuid,text[]) from public,anon;
revoke all on function rebuild_v2_private.grant_role(uuid,text,text) from public,anon,authenticated;
revoke all on function rebuild_v2_private.post_wallet_entry(uuid,text,bigint,text,text,text,text,uuid) from public,anon,authenticated;
revoke all on function rebuild_v2_private.request_developer_role(text) from public,anon,authenticated;
revoke all on function rebuild_v2_private.review_role_request(uuid,text,text) from public,anon,authenticated;

grant execute on function rebuild_v2_private.has_role(uuid,text[]) to authenticated;
-- No client EXECUTE grant: this implementation has no exposed V2 RPC wrapper.
-- No client EXECUTE grant: this implementation has no exposed V2 RPC wrapper.
-- No client EXECUTE grant: this implementation has no exposed V2 RPC wrapper.
-- No client EXECUTE grant: this implementation has no exposed V2 RPC wrapper.
