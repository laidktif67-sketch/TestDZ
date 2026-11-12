-- Add the developer-facing priority field to the feedback workflow.
begin;

alter table public.developer_feedback_reviews
  add column if not exists priority text not null default 'normal'
  check (priority in ('low', 'normal', 'high', 'urgent'));

commit;
