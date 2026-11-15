-- TestDZ rebuild v2 candidate schema baseline.
-- Generated from the isolated TestDZ-FixLab rebuild_v2 candidate.
-- Not a production migration. Apply only to a clean, disposable test database.
create schema if not exists rebuild_v2;
create schema if not exists rebuild_v2_private;
revoke all on schema rebuild_v2 from public, anon;
revoke all on schema rebuild_v2_private from public, anon;
grant usage on schema rebuild_v2 to authenticated;
grant usage on schema rebuild_v2_private to authenticated;
set search_path = pg_catalog, rebuild_v2, auth;

CREATE TABLE rebuild_v2.profiles (
id uuid NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  locale text DEFAULT 'fr-DZ'::text NOT NULL,
  phone text,
  interests jsonb DEFAULT '[]'::jsonb NOT NULL,
  is_verified boolean DEFAULT false NOT NULL,
  is_banned boolean DEFAULT false NOT NULL,
  onboarding_completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_interests_check CHECK (jsonb_typeof(interests) = 'array'::text),
  CONSTRAINT profiles_locale_check CHECK (char_length(locale) >= 2 AND char_length(locale) <= 16),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

CREATE TABLE rebuild_v2.user_roles (
user_id uuid NOT NULL,
  role text NOT NULL,
  granted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role),
  CONSTRAINT user_roles_role_check CHECK (role = ANY (ARRAY['tester'::text, 'developer'::text, 'admin'::text, 'financial'::text, 'support'::text])),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE CASCADE
);

CREATE TABLE rebuild_v2.role_requests (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  requested_role text NOT NULL,
  reason text,
  status text DEFAULT 'pending'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT role_requests_check CHECK (status = 'pending'::text AND reviewed_by IS NULL AND reviewed_at IS NULL OR (status = ANY (ARRAY['approved'::text, 'rejected'::text])) AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL),
  CONSTRAINT role_requests_pkey PRIMARY KEY (id),
  CONSTRAINT role_requests_reason_check CHECK (reason IS NULL OR char_length(reason) <= 2000),
  CONSTRAINT role_requests_requested_role_check CHECK (requested_role = 'developer'::text),
  CONSTRAINT role_requests_review_note_check CHECK (review_note IS NULL OR char_length(review_note) <= 2000),
  CONSTRAINT role_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT role_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  CONSTRAINT role_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE CASCADE
);

CREATE TABLE rebuild_v2.devices (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  fingerprint_hash text NOT NULL,
  platform text NOT NULL,
  app_version text,
  first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  revoked_at timestamp with time zone,
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_platform_check CHECK (platform = ANY (ARRAY['android'::text, 'ios'::text, 'web'::text, 'other'::text])),
  CONSTRAINT devices_user_id_fingerprint_hash_key UNIQUE (user_id, fingerprint_hash),
  CONSTRAINT devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE CASCADE
);

CREATE TABLE rebuild_v2.apps (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  developer_id uuid NOT NULL,
  name text NOT NULL,
  package_name text NOT NULL,
  description text,
  icon_url text,
  play_store_url text,
  category text DEFAULT 'other'::text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  distribution_method text DEFAULT 'none'::text NOT NULL,
  distribution_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT apps_category_check CHECK (category = ANY (ARRAY['games'::text, 'tools'::text, 'education'::text, 'social'::text, 'health'::text, 'other'::text])),
  CONSTRAINT apps_developer_id_fkey FOREIGN KEY (developer_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT apps_distribution_method_check CHECK (distribution_method = ANY (ARRAY['none'::text, 'play_store'::text, 'external_link'::text, 'apk_upload'::text])),
  CONSTRAINT apps_distribution_url_check CHECK (distribution_url IS NULL OR char_length(distribution_url) >= 8 AND char_length(distribution_url) <= 2048 AND distribution_url ~* '^https?://[^[:space:]]+$'::text),
  CONSTRAINT apps_id_developer_id_key UNIQUE (id, developer_id),
  CONSTRAINT apps_name_check CHECK (char_length(name) >= 2 AND char_length(name) <= 120),
  CONSTRAINT apps_package_name_check CHECK (char_length(package_name) >= 3 AND char_length(package_name) <= 255),
  CONSTRAINT apps_package_name_key UNIQUE (package_name),
  CONSTRAINT apps_pkey PRIMARY KEY (id),
  CONSTRAINT apps_status_check CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'published'::text, 'paused'::text, 'archived'::text, 'rejected'::text]))
);

CREATE TABLE rebuild_v2.tests (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  app_id uuid NOT NULL,
  developer_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  short_summary text,
  test_type text DEFAULT 'custom'::text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  min_testers integer DEFAULT 12 NOT NULL,
  start_date date,
  end_date date,
  estimated_duration_minutes integer,
  android_min_api integer,
  android_max_api integer,
  device_requirements jsonb DEFAULT '{}'::jsonb NOT NULL,
  eligibility_criteria jsonb DEFAULT '[]'::jsonb NOT NULL,
  tester_instructions text,
  test_config jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT tests_android_max_api_check CHECK (android_max_api >= 21 AND android_max_api <= 100),
  CONSTRAINT tests_android_min_api_check CHECK (android_min_api >= 21 AND android_min_api <= 100),
  CONSTRAINT tests_app_id_developer_id_fkey FOREIGN KEY (app_id, developer_id) REFERENCES rebuild_v2.apps(id, developer_id) ON DELETE RESTRICT,
  CONSTRAINT tests_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT tests_check1 CHECK (android_min_api IS NULL OR android_max_api IS NULL OR android_max_api >= android_min_api),
  CONSTRAINT tests_device_requirements_check CHECK (jsonb_typeof(device_requirements) = 'object'::text),
  CONSTRAINT tests_eligibility_criteria_check CHECK (jsonb_typeof(eligibility_criteria) = 'array'::text),
  CONSTRAINT tests_estimated_duration_minutes_check CHECK (estimated_duration_minutes >= 1 AND estimated_duration_minutes <= 1440),
  CONSTRAINT tests_id_developer_id_key UNIQUE (id, developer_id),
  CONSTRAINT tests_min_testers_check CHECK (min_testers >= 1 AND min_testers <= 500),
  CONSTRAINT tests_pkey PRIMARY KEY (id),
  CONSTRAINT tests_short_summary_check CHECK (short_summary IS NULL OR char_length(short_summary) <= 240),
  CONSTRAINT tests_status_check CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'recruiting'::text, 'ready'::text, 'running'::text, 'at_risk'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])),
  CONSTRAINT tests_test_config_check CHECK (jsonb_typeof(test_config) = 'object'::text),
  CONSTRAINT tests_test_type_check CHECK (test_type = ANY (ARRAY['google_play_closed'::text, 'apk_testing'::text, 'bug_discovery'::text, 'usability'::text, 'compatibility'::text, 'custom'::text])),
  CONSTRAINT tests_tester_instructions_check CHECK (tester_instructions IS NULL OR char_length(tester_instructions) <= 12000),
  CONSTRAINT tests_title_check CHECK (char_length(title) >= 3 AND char_length(title) <= 160)
);

CREATE TABLE rebuild_v2.test_steps (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  test_id uuid NOT NULL,
  step_order integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  is_required boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT test_steps_description_check CHECK (char_length(description) >= 1 AND char_length(description) <= 4000),
  CONSTRAINT test_steps_pkey PRIMARY KEY (id),
  CONSTRAINT test_steps_step_order_check CHECK (step_order > 0),
  CONSTRAINT test_steps_test_id_fkey FOREIGN KEY (test_id) REFERENCES rebuild_v2.tests(id) ON DELETE CASCADE,
  CONSTRAINT test_steps_test_id_step_order_key UNIQUE (test_id, step_order),
  CONSTRAINT test_steps_title_check CHECK (char_length(title) >= 2 AND char_length(title) <= 160)
);

CREATE TABLE rebuild_v2.test_requirements (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  test_id uuid NOT NULL,
  requirement_type text DEFAULT 'other'::text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  is_mandatory boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT test_requirements_description_check CHECK (char_length(description) >= 1 AND char_length(description) <= 2000),
  CONSTRAINT test_requirements_pkey PRIMARY KEY (id),
  CONSTRAINT test_requirements_requirement_type_check CHECK (requirement_type = ANY (ARRAY['device'::text, 'android_version'::text, 'account'::text, 'network'::text, 'eligibility'::text, 'other'::text])),
  CONSTRAINT test_requirements_test_id_fkey FOREIGN KEY (test_id) REFERENCES rebuild_v2.tests(id) ON DELETE CASCADE,
  CONSTRAINT test_requirements_title_check CHECK (char_length(title) >= 2 AND char_length(title) <= 160)
);

CREATE TABLE rebuild_v2.test_media (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  test_id uuid NOT NULL,
  media_type text NOT NULL,
  storage_path text NOT NULL,
  alt_text text,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT test_media_alt_text_check CHECK (alt_text IS NULL OR char_length(alt_text) <= 300),
  CONSTRAINT test_media_media_type_check CHECK (media_type = ANY (ARRAY['image'::text, 'video'::text, 'document'::text])),
  CONSTRAINT test_media_pkey PRIMARY KEY (id),
  CONSTRAINT test_media_storage_path_check CHECK (char_length(storage_path) >= 1 AND char_length(storage_path) <= 1024),
  CONSTRAINT test_media_storage_path_key UNIQUE (storage_path),
  CONSTRAINT test_media_test_id_fkey FOREIGN KEY (test_id) REFERENCES rebuild_v2.tests(id) ON DELETE CASCADE
);

CREATE TABLE rebuild_v2.cohorts (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  capacity integer NOT NULL,
  status text DEFAULT 'forming'::text NOT NULL,
  created_by uuid NOT NULL,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT cohorts_capacity_check CHECK (capacity > 0),
  CONSTRAINT cohorts_check CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT cohorts_created_by_fkey FOREIGN KEY (created_by) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT cohorts_name_check CHECK (char_length(name) >= 2 AND char_length(name) <= 120),
  CONSTRAINT cohorts_pkey PRIMARY KEY (id),
  CONSTRAINT cohorts_status_check CHECK (status = ANY (ARRAY['forming'::text, 'ready'::text, 'running'::text, 'completed'::text, 'cancelled'::text]))
);

CREATE TABLE rebuild_v2.cohort_tests (
cohort_id uuid NOT NULL,
  test_id uuid NOT NULL,
  developer_id uuid NOT NULL,
  added_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT cohort_tests_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES rebuild_v2.cohorts(id) ON DELETE RESTRICT,
  CONSTRAINT cohort_tests_pkey PRIMARY KEY (cohort_id, test_id),
  CONSTRAINT cohort_tests_test_id_developer_id_fkey FOREIGN KEY (test_id, developer_id) REFERENCES rebuild_v2.tests(id, developer_id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.assignments (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  cohort_id uuid NOT NULL,
  test_id uuid NOT NULL,
  tester_id uuid NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  assigned_at timestamp with time zone DEFAULT now() NOT NULL,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  due_at timestamp with time zone,
  medical_extension_days integer DEFAULT 0 NOT NULL,
  medical_exception_approved_at timestamp with time zone,
  medical_exception_approved_by uuid,
  medical_exception_note text,
  CONSTRAINT assignments_check CHECK (medical_extension_days = 0 AND medical_exception_approved_at IS NULL AND medical_exception_approved_by IS NULL OR medical_extension_days > 0 AND medical_exception_approved_at IS NOT NULL AND medical_exception_approved_by IS NOT NULL AND medical_exception_note IS NOT NULL),
  CONSTRAINT assignments_cohort_id_test_id_fkey FOREIGN KEY (cohort_id, test_id) REFERENCES rebuild_v2.cohort_tests(cohort_id, test_id) ON DELETE RESTRICT,
  CONSTRAINT assignments_id_test_id_tester_id_key UNIQUE (id, test_id, tester_id),
  CONSTRAINT assignments_medical_exception_approved_by_fkey FOREIGN KEY (medical_exception_approved_by) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT assignments_medical_extension_days_check CHECK (medical_extension_days >= 0),
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'withdrawn'::text, 'failed'::text, 'rejected'::text])),
  CONSTRAINT assignments_test_id_tester_id_key UNIQUE (test_id, tester_id),
  CONSTRAINT assignments_tester_id_fkey FOREIGN KEY (tester_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.checkins (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  assignment_id uuid NOT NULL,
  tester_id uuid NOT NULL,
  checkin_date date DEFAULT CURRENT_DATE NOT NULL,
  note text,
  evidence_path text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT checkins_assignment_id_checkin_date_key UNIQUE (assignment_id, checkin_date),
  CONSTRAINT checkins_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES rebuild_v2.assignments(id) ON DELETE CASCADE,
  CONSTRAINT checkins_note_check CHECK (note IS NULL OR char_length(note) <= 4000),
  CONSTRAINT checkins_pkey PRIMARY KEY (id),
  CONSTRAINT checkins_tester_id_fkey FOREIGN KEY (tester_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.feedback (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  assignment_id uuid NOT NULL,
  tester_id uuid NOT NULL,
  category text NOT NULL,
  body text NOT NULL,
  rating smallint,
  quality_status text DEFAULT 'pending'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT feedback_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES rebuild_v2.assignments(id) ON DELETE RESTRICT,
  CONSTRAINT feedback_assignment_id_key UNIQUE (assignment_id),
  CONSTRAINT feedback_body_check CHECK (char_length(body) >= 20 AND char_length(body) <= 8000),
  CONSTRAINT feedback_category_check CHECK (category = ANY (ARRAY['general'::text, 'bug'::text, 'usability'::text, 'performance'::text, 'compatibility'::text])),
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_quality_status_check CHECK (quality_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])),
  CONSTRAINT feedback_rating_check CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT feedback_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT feedback_tester_id_fkey FOREIGN KEY (tester_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.medical_exception_requests (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  assignment_id uuid NOT NULL,
  tester_id uuid NOT NULL,
  reason text NOT NULL,
  requested_dates date[] NOT NULL,
  evidence_storage_path text,
  status text DEFAULT 'pending'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT medical_exception_requests_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES rebuild_v2.assignments(id) ON DELETE RESTRICT,
  CONSTRAINT medical_exception_requests_check CHECK (status = 'pending'::text AND reviewed_by IS NULL AND reviewed_at IS NULL OR (status = ANY (ARRAY['approved'::text, 'rejected'::text])) AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL),
  CONSTRAINT medical_exception_requests_evidence_storage_path_check CHECK (evidence_storage_path IS NULL OR char_length(evidence_storage_path) <= 1024),
  CONSTRAINT medical_exception_requests_pkey PRIMARY KEY (id),
  CONSTRAINT medical_exception_requests_reason_check CHECK (char_length(reason) >= 20 AND char_length(reason) <= 4000),
  CONSTRAINT medical_exception_requests_requested_dates_check CHECK (cardinality(requested_dates) >= 1 AND cardinality(requested_dates) <= 14),
  CONSTRAINT medical_exception_requests_review_note_check CHECK (review_note IS NULL OR char_length(review_note) <= 2000),
  CONSTRAINT medical_exception_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT medical_exception_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  CONSTRAINT medical_exception_requests_tester_id_fkey FOREIGN KEY (tester_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.wallets (
user_id uuid NOT NULL,
  earned_points bigint DEFAULT 0 NOT NULL,
  purchased_credits bigint DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT wallets_earned_points_check CHECK (earned_points >= 0),
  CONSTRAINT wallets_pkey PRIMARY KEY (user_id),
  CONSTRAINT wallets_purchased_credits_check CHECK (purchased_credits >= 0),
  CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.wallet_ledger (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  wallet_type text NOT NULL,
  amount bigint NOT NULL,
  entry_type text NOT NULL,
  reference_type text,
  reference_id uuid,
  idempotency_key text NOT NULL,
  actor_id uuid,
  reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT wallet_ledger_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT wallet_ledger_amount_check CHECK (amount <> 0),
  CONSTRAINT wallet_ledger_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT wallet_ledger_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT wallet_ledger_wallet_type_check CHECK (wallet_type = ANY (ARRAY['earned_points'::text, 'purchased_credits'::text]))
);

CREATE TABLE rebuild_v2.plans (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  price_dzd bigint NOT NULL,
  billing_period text NOT NULL,
  features jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT plans_billing_period_check CHECK (billing_period = ANY (ARRAY['month'::text, 'year'::text, 'one_time'::text])),
  CONSTRAINT plans_code_key UNIQUE (code),
  CONSTRAINT plans_pkey PRIMARY KEY (id),
  CONSTRAINT plans_price_dzd_check CHECK (price_dzd >= 0)
);

CREATE TABLE rebuild_v2.subscriptions (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  status text NOT NULL,
  current_period_start timestamp with time zone NOT NULL,
  current_period_end timestamp with time zone NOT NULL,
  cancel_at_period_end boolean DEFAULT false NOT NULL,
  provider text,
  provider_subscription_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT subscriptions_check CHECK (current_period_end > current_period_start),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES rebuild_v2.plans(id) ON DELETE RESTRICT,
  CONSTRAINT subscriptions_status_check CHECK (status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'cancelled'::text, 'expired'::text])),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.payments (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  subscription_id uuid,
  amount_dzd bigint NOT NULL,
  currency text DEFAULT 'DZD'::text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  provider text,
  provider_reference text,
  idempotency_key text NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT payments_amount_dzd_check CHECK (amount_dzd > 0),
  CONSTRAINT payments_currency_check CHECK (currency = 'DZD'::text),
  CONSTRAINT payments_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_status_check CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text, 'refunded'::text])),
  CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES rebuild_v2.subscriptions(id) ON DELETE SET NULL,
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.refunds (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  payment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount_dzd bigint NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'requested'::text NOT NULL,
  refund_method text NOT NULL,
  approved_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT refunds_amount_dzd_check CHECK (amount_dzd > 0),
  CONSTRAINT refunds_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES rebuild_v2.payments(id) ON DELETE RESTRICT,
  CONSTRAINT refunds_pkey PRIMARY KEY (id),
  CONSTRAINT refunds_refund_method_check CHECK (refund_method = ANY (ARRAY['wallet_credit'::text, 'bank_return'::text])),
  CONSTRAINT refunds_status_check CHECK (status = ANY (ARRAY['requested'::text, 'approved'::text, 'rejected'::text, 'processed'::text])),
  CONSTRAINT refunds_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.support_tickets (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_number bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  requester_role text NOT NULL,
  subject text NOT NULL,
  category text NOT NULL,
  priority text DEFAULT 'normal'::text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  assigned_to uuid,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT support_tickets_category_check CHECK (category = ANY (ARRAY['technical'::text, 'account'::text, 'testing'::text, 'rewards'::text, 'payments'::text, 'other'::text])),
  CONSTRAINT support_tickets_description_check CHECK (char_length(btrim(description)) >= 10 AND char_length(btrim(description)) <= 5000),
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT support_tickets_priority_check CHECK (priority = ANY (ARRAY['normal'::text, 'high'::text, 'urgent'::text])),
  CONSTRAINT support_tickets_requester_role_check CHECK (requester_role = ANY (ARRAY['tester'::text, 'developer'::text])),
  CONSTRAINT support_tickets_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT support_tickets_status_check CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'waiting_for_user'::text, 'resolved'::text, 'closed'::text])),
  CONSTRAINT support_tickets_subject_check CHECK (char_length(btrim(subject)) >= 5 AND char_length(btrim(subject)) <= 120),
  CONSTRAINT support_tickets_ticket_number_key UNIQUE (ticket_number),
  CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.support_ticket_messages (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  internal_note boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT support_messages_ticket_id_id_v2 UNIQUE (ticket_id, id),
  CONSTRAINT support_ticket_messages_body_check CHECK (char_length(btrim(body)) >= 1 AND char_length(btrim(body)) <= 5000),
  CONSTRAINT support_ticket_messages_pkey PRIMARY KEY (id),
  CONSTRAINT support_ticket_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT support_ticket_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES rebuild_v2.support_tickets(id) ON DELETE CASCADE
);

CREATE TABLE rebuild_v2.notifications (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb NOT NULL,
  read_at timestamp with time zone,
  archived_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE CASCADE
);

CREATE TABLE rebuild_v2.audit_events (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  reason text,
  request_id text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT audit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT audit_events_pkey PRIMARY KEY (id)
);

CREATE TABLE rebuild_v2.reports (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  reporter_id uuid NOT NULL,
  reported_user_id uuid,
  assignment_id uuid,
  report_type text NOT NULL,
  description text NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT reports_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES rebuild_v2.assignments(id) ON DELETE RESTRICT,
  CONSTRAINT reports_description_check CHECK (char_length(description) >= 20 AND char_length(description) <= 5000),
  CONSTRAINT reports_id_assignment_id_v2 UNIQUE (id, assignment_id),
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_report_type_check CHECK (report_type = ANY (ARRAY['no_activity'::text, 'fake_feedback'::text, 'app_broken'::text, 'harassment'::text, 'payment_dispute'::text, 'other'::text])),
  CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT reports_status_check CHECK (status = ANY (ARRAY['open'::text, 'under_review'::text, 'resolved'::text, 'rejected'::text]))
);

CREATE TABLE rebuild_v2.developer_feedback_messages (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  feedback_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT developer_feedback_messages_body_check CHECK (char_length(btrim(body)) >= 1 AND char_length(btrim(body)) <= 5000),
  CONSTRAINT developer_feedback_messages_feedback_id_fkey FOREIGN KEY (feedback_id) REFERENCES rebuild_v2.feedback(id) ON DELETE CASCADE,
  CONSTRAINT developer_feedback_messages_pkey PRIMARY KEY (id),
  CONSTRAINT developer_feedback_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.developer_feedback_reviews (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  feedback_id uuid NOT NULL,
  developer_id uuid NOT NULL,
  status text DEFAULT 'new'::text NOT NULL,
  resolution_note text,
  priority text DEFAULT 'normal'::text NOT NULL,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT developer_feedback_reviews_developer_id_fkey FOREIGN KEY (developer_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT developer_feedback_reviews_feedback_id_fkey FOREIGN KEY (feedback_id) REFERENCES rebuild_v2.feedback(id) ON DELETE CASCADE,
  CONSTRAINT developer_feedback_reviews_feedback_id_key UNIQUE (feedback_id),
  CONSTRAINT developer_feedback_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT developer_feedback_reviews_priority_check CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  CONSTRAINT developer_feedback_reviews_resolution_note_check CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
  CONSTRAINT developer_feedback_reviews_status_check CHECK (status = ANY (ARRAY['new'::text, 'under_review'::text, 'planned'::text, 'resolved'::text, 'wont_fix'::text]))
);

CREATE TABLE rebuild_v2.developer_feedback_events (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  feedback_id uuid NOT NULL,
  actor_id uuid,
  event_type text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT developer_feedback_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT developer_feedback_events_event_type_check CHECK (event_type = ANY (ARRAY['created'::text, 'status_changed'::text, 'priority_changed'::text, 'message_sent'::text, 'attachment_added'::text])),
  CONSTRAINT developer_feedback_events_feedback_id_fkey FOREIGN KEY (feedback_id) REFERENCES rebuild_v2.feedback(id) ON DELETE CASCADE,
  CONSTRAINT developer_feedback_events_pkey PRIMARY KEY (id)
);

CREATE TABLE rebuild_v2.developer_feedback_attachments (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  feedback_id uuid NOT NULL,
  message_id uuid,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT developer_feedback_attachments_feedback_id_fkey FOREIGN KEY (feedback_id) REFERENCES rebuild_v2.feedback(id) ON DELETE CASCADE,
  CONSTRAINT developer_feedback_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES rebuild_v2.developer_feedback_messages(id) ON DELETE CASCADE,
  CONSTRAINT developer_feedback_attachments_mime_type_check CHECK (mime_type = ANY (ARRAY['image/png'::text, 'image/jpeg'::text, 'image/webp'::text, 'text/plain'::text, 'application/pdf'::text, 'application/zip'::text])),
  CONSTRAINT developer_feedback_attachments_original_filename_check CHECK (char_length(original_filename) >= 1 AND char_length(original_filename) <= 255),
  CONSTRAINT developer_feedback_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT developer_feedback_attachments_size_bytes_check CHECK (size_bytes >= 1 AND size_bytes <= 10485760),
  CONSTRAINT developer_feedback_attachments_storage_path_key UNIQUE (storage_path),
  CONSTRAINT developer_feedback_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.coupons (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  discount_type text NOT NULL,
  discount_value integer NOT NULL,
  max_redemptions integer,
  redemption_count integer DEFAULT 0 NOT NULL,
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT false NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT coupons_check CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at),
  CONSTRAINT coupons_check1 CHECK (discount_type <> 'percentage'::text OR discount_value <= 100),
  CONSTRAINT coupons_code_key UNIQUE (code),
  CONSTRAINT coupons_discount_type_check CHECK (discount_type = ANY (ARRAY['fixed_dzd'::text, 'percentage'::text, 'credits_bonus'::text])),
  CONSTRAINT coupons_discount_value_check CHECK (discount_value > 0),
  CONSTRAINT coupons_max_redemptions_check CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  CONSTRAINT coupons_pkey PRIMARY KEY (id),
  CONSTRAINT coupons_redemption_count_check CHECK (redemption_count >= 0)
);

CREATE TABLE rebuild_v2.coupon_redemptions (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  coupon_id uuid NOT NULL,
  user_id uuid NOT NULL,
  payment_id uuid,
  redeemed_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT coupon_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES rebuild_v2.coupons(id) ON DELETE RESTRICT,
  CONSTRAINT coupon_redemptions_coupon_id_user_id_key UNIQUE (coupon_id, user_id),
  CONSTRAINT coupon_redemptions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES rebuild_v2.payments(id) ON DELETE SET NULL,
  CONSTRAINT coupon_redemptions_pkey PRIMARY KEY (id),
  CONSTRAINT coupon_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.feature_usage (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  feature_key text NOT NULL,
  usage_count integer DEFAULT 1 NOT NULL,
  period_start date DEFAULT ((now() AT TIME ZONE 'UTC'::text))::date NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT feature_usage_pkey PRIMARY KEY (id),
  CONSTRAINT feature_usage_usage_count_check CHECK (usage_count > 0),
  CONSTRAINT feature_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL
);

CREATE TABLE rebuild_v2.referrals (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  referral_code text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  qualified_at timestamp with time zone,
  rewarded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT referrals_check CHECK (referrer_id <> referred_user_id),
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT referrals_referred_user_id_key UNIQUE (referred_user_id),
  CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT referrals_status_check CHECK (status = ANY (ARRAY['pending'::text, 'qualified'::text, 'rewarded'::text, 'rejected'::text]))
);

CREATE TABLE rebuild_v2.disputes (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  opened_by uuid NOT NULL,
  payment_id uuid,
  report_id uuid,
  status text DEFAULT 'opened'::text NOT NULL,
  resolution text,
  resolved_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT disputes_check CHECK (payment_id IS NOT NULL OR report_id IS NOT NULL),
  CONSTRAINT disputes_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT disputes_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES rebuild_v2.payments(id) ON DELETE SET NULL,
  CONSTRAINT disputes_pkey PRIMARY KEY (id),
  CONSTRAINT disputes_report_id_fkey FOREIGN KEY (report_id) REFERENCES rebuild_v2.reports(id) ON DELETE SET NULL,
  CONSTRAINT disputes_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT disputes_status_check CHECK (status = ANY (ARRAY['opened'::text, 'under_review'::text, 'resolved_accepted'::text, 'resolved_rejected'::text, 'escalated'::text]))
);

CREATE TABLE rebuild_v2.events (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  available_at timestamp with time zone DEFAULT now() NOT NULL,
  processed_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT events_attempts_check CHECK (attempts >= 0),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_status_check CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'delivered'::text, 'failed'::text]))
);

CREATE TABLE rebuild_v2.fraud_events (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  signal_code text NOT NULL,
  weight smallint DEFAULT 0 NOT NULL,
  evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
  occurred_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT fraud_events_pkey PRIMARY KEY (id),
  CONSTRAINT fraud_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.fraud_reviews (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  score smallint NOT NULL,
  signals jsonb DEFAULT '[]'::jsonb NOT NULL,
  priority text DEFAULT 'normal'::text NOT NULL,
  status text DEFAULT 'queued'::text NOT NULL,
  review_due_at timestamp with time zone,
  reviewed_by uuid,
  resolution text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT fraud_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT fraud_reviews_priority_check CHECK (priority = ANY (ARRAY['normal'::text, 'high'::text])),
  CONSTRAINT fraud_reviews_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT fraud_reviews_score_check CHECK (score >= 0 AND score <= 100),
  CONSTRAINT fraud_reviews_signals_check CHECK (jsonb_typeof(signals) = 'array'::text),
  CONSTRAINT fraud_reviews_status_check CHECK (status = ANY (ARRAY['queued'::text, 'in_review'::text, 'resolved'::text, 'dismissed'::text])),
  CONSTRAINT fraud_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.play_opt_in_events (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  assignment_id uuid NOT NULL,
  tester_id uuid NOT NULL,
  event_type text NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  evidence_url text,
  notes text,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT play_opt_in_events_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES rebuild_v2.assignments(id) ON DELETE CASCADE,
  CONSTRAINT play_opt_in_events_event_type_check CHECK (event_type = ANY (ARRAY['opted_in'::text, 'opted_out'::text, 'returned'::text, 'evidence_reviewed'::text])),
  CONSTRAINT play_opt_in_events_pkey PRIMARY KEY (id),
  CONSTRAINT play_opt_in_events_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT play_opt_in_events_tester_id_fkey FOREIGN KEY (tester_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.report_attachments (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  report_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  test_id uuid NOT NULL,
  tester_id uuid NOT NULL,
  file_id uuid NOT NULL,
  file_extension text NOT NULL,
  original_filename text NOT NULL,
  storage_path text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT report_attachments_assignment_id_test_id_tester_id_fkey FOREIGN KEY (assignment_id, test_id, tester_id) REFERENCES rebuild_v2.assignments(id, test_id, tester_id) ON DELETE RESTRICT,
  CONSTRAINT report_attachments_file_extension_check CHECK (file_extension = ANY (ARRAY['png'::text, 'jpg'::text, 'jpeg'::text, 'webp'::text, 'txt'::text, 'pdf'::text, 'zip'::text])),
  CONSTRAINT report_attachments_file_id_key UNIQUE (file_id),
  CONSTRAINT report_attachments_original_filename_check CHECK (char_length(original_filename) >= 1 AND char_length(original_filename) <= 255 AND original_filename !~ '[[:cntrl:]]'::text),
  CONSTRAINT report_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT report_attachments_report_id_assignment_id_fkey FOREIGN KEY (report_id, assignment_id) REFERENCES rebuild_v2.reports(id, assignment_id) ON DELETE RESTRICT,
  CONSTRAINT report_attachments_storage_path_key UNIQUE (storage_path),
  CONSTRAINT report_attachments_tester_id_fkey FOREIGN KEY (tester_id) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.support_ticket_attachments (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  message_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT support_ticket_attachments_mime_type_check CHECK (mime_type = ANY (ARRAY['image/png'::text, 'image/jpeg'::text, 'image/webp'::text, 'text/plain'::text, 'application/pdf'::text, 'application/zip'::text])),
  CONSTRAINT support_ticket_attachments_original_filename_check CHECK (char_length(original_filename) >= 1 AND char_length(original_filename) <= 255),
  CONSTRAINT support_ticket_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT support_ticket_attachments_size_bytes_check CHECK (size_bytes >= 1 AND size_bytes <= 10485760),
  CONSTRAINT support_ticket_attachments_storage_path_key UNIQUE (storage_path),
  CONSTRAINT support_ticket_attachments_ticket_id_message_id_fkey FOREIGN KEY (ticket_id, message_id) REFERENCES rebuild_v2.support_ticket_messages(ticket_id, id) ON DELETE CASCADE,
  CONSTRAINT support_ticket_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES rebuild_v2.profiles(id) ON DELETE RESTRICT
);

CREATE TABLE rebuild_v2.support_ticket_events (
id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  actor_id uuid,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  old_priority text,
  new_priority text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT support_ticket_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL,
  CONSTRAINT support_ticket_events_event_type_check CHECK (event_type = ANY (ARRAY['created'::text, 'status_changed'::text, 'priority_changed'::text])),
  CONSTRAINT support_ticket_events_pkey PRIMARY KEY (id),
  CONSTRAINT support_ticket_events_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES rebuild_v2.support_tickets(id) ON DELETE CASCADE
);

CREATE TABLE rebuild_v2.platform_config (
key text NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT platform_config_pkey PRIMARY KEY (key),
  CONSTRAINT platform_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES rebuild_v2.profiles(id) ON DELETE SET NULL
);

CREATE INDEX user_roles_granted_by_v2 ON rebuild_v2.user_roles USING btree (granted_by);

CREATE INDEX role_requests_status_created_v2 ON rebuild_v2.role_requests USING btree (status, created_at DESC);

CREATE UNIQUE INDEX role_requests_one_pending_per_user_v2 ON rebuild_v2.role_requests USING btree (user_id) WHERE (status = 'pending'::text);

CREATE INDEX devices_user_v2 ON rebuild_v2.devices USING btree (user_id);

CREATE INDEX apps_developer_created_v2 ON rebuild_v2.apps USING btree (developer_id, created_at DESC);

CREATE INDEX tests_developer_status_v2 ON rebuild_v2.tests USING btree (developer_id, status, created_at DESC);

CREATE INDEX tests_app_developer_v2 ON rebuild_v2.tests USING btree (app_id, developer_id);

CREATE INDEX test_steps_test_v2 ON rebuild_v2.test_steps USING btree (test_id);

CREATE INDEX test_requirements_test_v2 ON rebuild_v2.test_requirements USING btree (test_id);

CREATE INDEX test_media_test_v2 ON rebuild_v2.test_media USING btree (test_id);

CREATE INDEX cohorts_creator_v2 ON rebuild_v2.cohorts USING btree (created_by);

CREATE INDEX cohort_tests_test_developer_v2 ON rebuild_v2.cohort_tests USING btree (test_id, developer_id);

CREATE INDEX assignments_tester_status_v2 ON rebuild_v2.assignments USING btree (tester_id, status, assigned_at DESC);

CREATE INDEX assignments_medical_approver_v2 ON rebuild_v2.assignments USING btree (medical_exception_approved_by);

CREATE INDEX assignments_cohort_test_v2 ON rebuild_v2.assignments USING btree (cohort_id, test_id);

CREATE INDEX checkins_tester_v2 ON rebuild_v2.checkins USING btree (tester_id);

CREATE INDEX feedback_reviewer_v2 ON rebuild_v2.feedback USING btree (reviewed_by);

CREATE INDEX feedback_tester_v2 ON rebuild_v2.feedback USING btree (tester_id);

CREATE INDEX medical_requests_tester_v2 ON rebuild_v2.medical_exception_requests USING btree (tester_id);

CREATE INDEX medical_requests_reviewer_v2 ON rebuild_v2.medical_exception_requests USING btree (reviewed_by);

CREATE UNIQUE INDEX medical_exception_one_pending_per_assignment_v2 ON rebuild_v2.medical_exception_requests USING btree (assignment_id) WHERE (status = 'pending'::text);

CREATE INDEX ledger_user_created_v2 ON rebuild_v2.wallet_ledger USING btree (user_id, created_at DESC);

CREATE INDEX wallet_ledger_actor_v2 ON rebuild_v2.wallet_ledger USING btree (actor_id);

CREATE UNIQUE INDEX subscriptions_one_current_per_user_v2 ON rebuild_v2.subscriptions USING btree (user_id) WHERE (status = ANY (ARRAY['active'::text, 'trialing'::text, 'past_due'::text]));

CREATE INDEX subscriptions_plan_v2 ON rebuild_v2.subscriptions USING btree (plan_id);

CREATE INDEX subscriptions_user_v2 ON rebuild_v2.subscriptions USING btree (user_id);

CREATE INDEX payments_user_created_v2 ON rebuild_v2.payments USING btree (user_id, created_at DESC);

CREATE INDEX payments_subscription_v2 ON rebuild_v2.payments USING btree (subscription_id);

CREATE INDEX refunds_payment_v2 ON rebuild_v2.refunds USING btree (payment_id);

CREATE INDEX refunds_approver_v2 ON rebuild_v2.refunds USING btree (approved_by);

CREATE INDEX refunds_user_v2 ON rebuild_v2.refunds USING btree (user_id);

CREATE INDEX support_ticket_resolver_v2 ON rebuild_v2.support_tickets USING btree (resolved_by);

CREATE INDEX support_user_created_v2 ON rebuild_v2.support_tickets USING btree (user_id, created_at DESC);

CREATE INDEX support_ticket_assignee_v2 ON rebuild_v2.support_tickets USING btree (assigned_to);

CREATE INDEX support_messages_ticket_v2 ON rebuild_v2.support_ticket_messages USING btree (ticket_id);

CREATE INDEX support_messages_sender_v2 ON rebuild_v2.support_ticket_messages USING btree (sender_id);

CREATE INDEX notifications_user_created_v2 ON rebuild_v2.notifications USING btree (user_id, created_at DESC);

CREATE INDEX audit_events_actor_v2 ON rebuild_v2.audit_events USING btree (actor_id);

CREATE INDEX reports_reviewer_v2 ON rebuild_v2.reports USING btree (reviewed_by);

CREATE INDEX reports_assignment_v2 ON rebuild_v2.reports USING btree (assignment_id);

CREATE INDEX reports_reporter_v2 ON rebuild_v2.reports USING btree (reporter_id);

CREATE INDEX reports_reported_user_v2 ON rebuild_v2.reports USING btree (reported_user_id);

CREATE INDEX dev_feedback_messages_feedback_v2 ON rebuild_v2.developer_feedback_messages USING btree (feedback_id);

CREATE INDEX dev_feedback_messages_sender_v2 ON rebuild_v2.developer_feedback_messages USING btree (sender_id);

CREATE INDEX dev_feedback_reviews_developer_v2 ON rebuild_v2.developer_feedback_reviews USING btree (developer_id);

CREATE INDEX dev_feedback_events_actor_v2 ON rebuild_v2.developer_feedback_events USING btree (actor_id);

CREATE INDEX dev_feedback_events_feedback_v2 ON rebuild_v2.developer_feedback_events USING btree (feedback_id);

CREATE INDEX dev_feedback_attachments_feedback_v2 ON rebuild_v2.developer_feedback_attachments USING btree (feedback_id);

CREATE INDEX dev_feedback_attachments_message_v2 ON rebuild_v2.developer_feedback_attachments USING btree (message_id);

CREATE INDEX dev_feedback_attachments_uploader_v2 ON rebuild_v2.developer_feedback_attachments USING btree (uploaded_by);

CREATE INDEX coupon_redemptions_payment_v2 ON rebuild_v2.coupon_redemptions USING btree (payment_id);

CREATE INDEX coupon_redemptions_user_v2 ON rebuild_v2.coupon_redemptions USING btree (user_id);

CREATE INDEX feature_usage_user_period_v2 ON rebuild_v2.feature_usage USING btree (user_id, feature_key, period_start);

CREATE INDEX referrals_referrer_v2 ON rebuild_v2.referrals USING btree (referrer_id, created_at DESC);

CREATE INDEX disputes_payment_v2 ON rebuild_v2.disputes USING btree (payment_id);

CREATE INDEX disputes_report_v2 ON rebuild_v2.disputes USING btree (report_id);

CREATE INDEX disputes_resolver_v2 ON rebuild_v2.disputes USING btree (resolved_by);

CREATE INDEX disputes_opened_by_v2 ON rebuild_v2.disputes USING btree (opened_by);

CREATE INDEX events_dispatch_v2 ON rebuild_v2.events USING btree (status, available_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));

CREATE INDEX fraud_events_user_time_v2 ON rebuild_v2.fraud_events USING btree (user_id, occurred_at DESC);

CREATE INDEX fraud_reviews_reviewer_v2 ON rebuild_v2.fraud_reviews USING btree (reviewed_by);

CREATE INDEX fraud_reviews_user_v2 ON rebuild_v2.fraud_reviews USING btree (user_id);

CREATE INDEX play_opt_in_tester_v2 ON rebuild_v2.play_opt_in_events USING btree (tester_id);

CREATE INDEX play_opt_in_assignment_time_v2 ON rebuild_v2.play_opt_in_events USING btree (assignment_id, occurred_at);

CREATE INDEX play_opt_in_recorder_v2 ON rebuild_v2.play_opt_in_events USING btree (recorded_by);

CREATE INDEX report_attachments_assignment_v2 ON rebuild_v2.report_attachments USING btree (assignment_id, test_id, tester_id);

CREATE INDEX report_attachments_tester_v2 ON rebuild_v2.report_attachments USING btree (tester_id);

CREATE INDEX report_attachments_report_assignment_v2 ON rebuild_v2.report_attachments USING btree (report_id, assignment_id);

CREATE INDEX support_attachments_ticket_message_v2 ON rebuild_v2.support_ticket_attachments USING btree (ticket_id, message_id);

CREATE INDEX support_attachments_uploader_v2 ON rebuild_v2.support_ticket_attachments USING btree (uploaded_by);

CREATE INDEX support_events_ticket_created_v2 ON rebuild_v2.support_ticket_events USING btree (ticket_id, created_at);

CREATE INDEX support_events_actor_v2 ON rebuild_v2.support_ticket_events USING btree (actor_id);

CREATE INDEX platform_config_updated_by_v2 ON rebuild_v2.platform_config USING btree (updated_by);

ALTER TABLE rebuild_v2.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.user_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.role_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.role_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.devices FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.apps FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.tests FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.test_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.test_steps FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.test_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.test_requirements FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.test_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.test_media FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.cohorts FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.cohort_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.cohort_tests FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.checkins FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.feedback FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.medical_exception_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.medical_exception_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.wallets FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.wallet_ledger FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.plans FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.payments FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.refunds FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.support_tickets FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.support_ticket_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.notifications FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.audit_events FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.reports FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.developer_feedback_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.developer_feedback_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.developer_feedback_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.developer_feedback_reviews FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.developer_feedback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.developer_feedback_events FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.developer_feedback_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.developer_feedback_attachments FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.coupons FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.coupon_redemptions FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.feature_usage FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.referrals FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.disputes FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.events FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.fraud_events FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.fraud_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.fraud_reviews FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.play_opt_in_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.play_opt_in_events FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.report_attachments FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.support_ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.support_ticket_attachments FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.support_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.support_ticket_events FORCE ROW LEVEL SECURITY;

ALTER TABLE rebuild_v2.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE rebuild_v2.platform_config FORCE ROW LEVEL SECURITY;
