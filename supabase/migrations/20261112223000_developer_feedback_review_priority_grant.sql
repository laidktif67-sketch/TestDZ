-- Allow developers to update the priority field added by the preceding migration.
begin;

grant update (priority) on public.developer_feedback_reviews to authenticated;

commit;
