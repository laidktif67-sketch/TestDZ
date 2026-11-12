-- Developer-owned feedback workflow. Quality decisions remain in public.feedback.
begin;

create table public.developer_feedback_reviews (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null unique references public.feedback(id) on delete cascade,
  developer_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'new'
    check (status in ('new','under_review','planned','resolved','wont_fix')),
  resolution_note text,
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint developer_feedback_resolution_note_length
    check (resolution_note is null or char_length(resolution_note) <= 2000)
);

create index developer_feedback_reviews_owner_status_idx
  on public.developer_feedback_reviews(developer_id,status,updated_at desc);

alter table public.developer_feedback_reviews enable row level security;
revoke all on public.developer_feedback_reviews from anon, authenticated;
grant select, insert on public.developer_feedback_reviews to authenticated;
grant update (status,resolution_note,updated_at,resolved_at) on public.developer_feedback_reviews to authenticated;

create policy developer_feedback_reviews_select_owner on public.developer_feedback_reviews
  for select to authenticated
  using (
    developer_id = (select auth.uid())
    and exists (
      select 1 from public.feedback f
      join public.assignments a on a.id = f.assignment_id
      join public.tests t on t.id = a.test_id
      where f.id = feedback_id and t.developer_id = (select auth.uid())
    )
  );

create policy developer_feedback_reviews_insert_owner on public.developer_feedback_reviews
  for insert to authenticated
  with check (
    developer_id = (select auth.uid())
    and exists (
      select 1 from public.feedback f
      join public.assignments a on a.id = f.assignment_id
      join public.tests t on t.id = a.test_id
      where f.id = feedback_id and t.developer_id = (select auth.uid())
    )
  );

create policy developer_feedback_reviews_update_owner on public.developer_feedback_reviews
  for update to authenticated
  using (
    developer_id = (select auth.uid())
    and exists (
      select 1 from public.feedback f
      join public.assignments a on a.id = f.assignment_id
      join public.tests t on t.id = a.test_id
      where f.id = feedback_id and t.developer_id = (select auth.uid())
    )
  )
  with check (
    developer_id = (select auth.uid())
    and exists (
      select 1 from public.feedback f
      join public.assignments a on a.id = f.assignment_id
      join public.tests t on t.id = a.test_id
      where f.id = feedback_id and t.developer_id = (select auth.uid())
    )
  );

commit;
