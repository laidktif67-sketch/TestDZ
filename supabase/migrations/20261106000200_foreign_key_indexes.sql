-- TestDZ / 002_foreign_key_indexes
-- Cover foreign-key lookup paths identified by Supabase performance advisor.

begin;

create index assignments_medical_exception_approved_by_idx on public.assignments(medical_exception_approved_by);
create index audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index cohorts_test_id_idx on public.cohorts(test_id);
create index disputes_opened_by_idx on public.disputes(opened_by);
create index disputes_payment_id_idx on public.disputes(payment_id);
create index disputes_report_id_idx on public.disputes(report_id);
create index disputes_resolved_by_idx on public.disputes(resolved_by);
create index feedback_assignment_id_idx on public.feedback(assignment_id);
create index feedback_reviewed_by_idx on public.feedback(reviewed_by);
create index feedback_tester_id_idx on public.feedback(tester_id);
create index fraud_reviews_reviewed_by_idx on public.fraud_reviews(reviewed_by);
create index fraud_reviews_user_id_idx on public.fraud_reviews(user_id);
create index payments_subscription_id_idx on public.payments(subscription_id);
create index payments_user_id_idx on public.payments(user_id);
create index platform_config_updated_by_idx on public.platform_config(updated_by);
create index play_opt_in_events_recorded_by_idx on public.play_opt_in_events(recorded_by);
create index play_opt_in_events_tester_id_idx on public.play_opt_in_events(tester_id);
create index points_ledger_reversal_of_idx on public.points_ledger(reversal_of);
create index refunds_approved_by_idx on public.refunds(approved_by);
create index refunds_payment_id_idx on public.refunds(payment_id);
create index refunds_user_id_idx on public.refunds(user_id);
create index reports_assignment_id_idx on public.reports(assignment_id);
create index reports_reported_user_id_idx on public.reports(reported_user_id);
create index reports_reporter_id_idx on public.reports(reporter_id);
create index subscriptions_plan_id_idx on public.subscriptions(plan_id);
create index tests_app_id_idx on public.tests(app_id);
create index tests_developer_id_idx on public.tests(developer_id);
create index user_roles_granted_by_idx on public.user_roles(granted_by);

commit;
