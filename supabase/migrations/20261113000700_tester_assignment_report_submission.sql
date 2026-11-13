-- Tester final assignment report and private evidence submission.
begin;

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique,
  test_id uuid not null,
  tester_id uuid not null,
  report_text text not null check (char_length(btrim(report_text)) between 20 and 2000),
  comments text not null default '' check (char_length(comments) <= 500),
  status text not null default 'submitted'
    check (status in ('submitted','accepted','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint assignment_submissions_assignment_fk
    foreign key (assignment_id, test_id, tester_id)
    references public.assignments(id, test_id, tester_id) on delete restrict,
  constraint assignment_submissions_review_consistency check (
    (status = 'submitted' and reviewed_by is null and reviewed_at is null)
    or (status in ('accepted','rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

create index assignment_submissions_test_status_idx
  on public.assignment_submissions(test_id, status, submitted_at desc);

alter table public.assignment_submissions
  add constraint assignment_submissions_id_assignment_test_tester_key
  unique (id, assignment_id, test_id, tester_id);

create table public.assignment_submission_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete restrict,
  assignment_id uuid not null,
  test_id uuid not null,
  tester_id uuid not null,
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  constraint assignment_submission_attachment_owner_fk
    foreign key (submission_id, assignment_id, test_id, tester_id)
    references public.assignment_submissions(id, assignment_id, test_id, tester_id)
    on delete restrict
);

alter table public.assignment_submission_attachments enable row level security;

-- New tables are created after the global suspension migration, so explicitly
-- inherit its restrictive account gate and write trigger.
create policy account_not_banned on public.assignment_submissions
  as restrictive for all to authenticated
  using (not (select private.is_current_user_banned()))
  with check (not (select private.is_current_user_banned()));
create policy account_not_banned on public.assignment_submission_attachments
  as restrictive for all to authenticated
  using (not (select private.is_current_user_banned()))
  with check (not (select private.is_current_user_banned()));

create trigger reject_banned_account_writes
  before insert or update or delete on public.assignment_submissions
  for each row execute function private.reject_banned_account_write();
create trigger reject_banned_account_writes
  before insert or update or delete on public.assignment_submission_attachments
  for each row execute function private.reject_banned_account_write();
alter table public.assignment_submissions enable row level security;
revoke all on public.assignment_submissions, public.assignment_submission_attachments from public, anon, authenticated;
grant select on public.assignment_submissions, public.assignment_submission_attachments to authenticated;

create policy assignment_submissions_select_participants
on public.assignment_submissions for select to authenticated
using (
  tester_id = (select auth.uid())
  or (select private.is_admin())
  or exists (select 1 from public.tests t
    where t.id = assignment_submissions.test_id and t.developer_id = (select auth.uid()))
);

create policy assignment_submission_attachments_select_participants
on public.assignment_submission_attachments for select to authenticated
using (
  tester_id = (select auth.uid())
  or (select private.is_admin())
  or exists (select 1 from public.tests t
    where t.id = assignment_submission_attachments.test_id and t.developer_id = (select auth.uid()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assignment-evidence','assignment-evidence',false,10485760,
  array['image/png','image/jpeg','image/webp','application/pdf']::text[]);

create or replace function private.can_upload_assignment_evidence(p_object_name text)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $function$
declare
  v_test_id uuid;
  v_tester_id uuid;
  v_assignment_id uuid;
begin
  if (select auth.uid()) is null or p_object_name is null
    or p_object_name !~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|pdf)$'
  then return false; end if;
  v_test_id := split_part(p_object_name,'/',1)::uuid;
  v_tester_id := split_part(p_object_name,'/',2)::uuid;
  v_assignment_id := split_part(p_object_name,'/',3)::uuid;
  return exists (
    select 1 from public.assignments a
    where a.id=v_assignment_id and a.test_id=v_test_id
      and a.tester_id=v_tester_id and a.tester_id=(select auth.uid())
      and a.status='active'
      and not exists (select 1 from public.assignment_submissions s where s.assignment_id=a.id)
  );
exception when invalid_text_representation then return false;
end;
$function$;

create or replace function private.can_read_assignment_evidence(p_object_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.assignment_submission_attachments x
    where x.storage_path = p_object_name
      and (
        x.tester_id = (select auth.uid())
        or (select private.is_admin())
        or exists (select 1 from public.tests t
          where t.id=x.test_id and t.developer_id=(select auth.uid()))
      )
  );
$function$;

revoke all on function private.can_upload_assignment_evidence(text) from public, anon, authenticated;
revoke all on function private.can_read_assignment_evidence(text) from public, anon, authenticated;
grant execute on function private.can_upload_assignment_evidence(text) to authenticated;
grant execute on function private.can_read_assignment_evidence(text) to authenticated;

create policy assignment_evidence_insert_owner
on storage.objects for insert to authenticated
with check (bucket_id='assignment-evidence' and private.can_upload_assignment_evidence(name));

create policy assignment_evidence_select_participants
on storage.objects for select to authenticated
using (bucket_id='assignment-evidence' and private.can_read_assignment_evidence(name));

create policy assignment_evidence_delete_unattached_owner
on storage.objects for delete to authenticated
using (
  bucket_id='assignment-evidence'
  and private.can_upload_assignment_evidence(name)
);

create or replace function public.submit_assignment_report(
  p_assignment_id uuid,
  p_report_text text,
  p_comments text default '',
  p_files jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_user_id uuid := auth.uid();
  v_test_id uuid;
  v_submission_id uuid;
  v_file jsonb;
  v_path text;
  v_name text;
  v_mime text;
  v_size bigint;
  v_extension text;
  v_count integer := 0;
begin
  if v_user_id is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501'; end if;
  if p_assignment_id is null then raise exception 'ASSIGNMENT_REQUIRED' using errcode='22023'; end if;
  if p_report_text is null or char_length(btrim(p_report_text)) < 20 or char_length(p_report_text) > 2000
    then raise exception 'REPORT_TEXT_INVALID' using errcode='22023'; end if;
  if p_comments is not null and char_length(p_comments)>500
    then raise exception 'REPORT_COMMENTS_TOO_LONG' using errcode='22023'; end if;
  if p_files is null or jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files)>5
    then raise exception 'REPORT_FILES_INVALID' using errcode='22023'; end if;

  select a.test_id into v_test_id
  from public.assignments a
  where a.id=p_assignment_id and a.tester_id=v_user_id and a.status='active'
  for update;
  if not found then raise exception 'ACTIVE_ASSIGNMENT_NOT_FOUND' using errcode='42501'; end if;
  if exists(select 1 from public.assignment_submissions s where s.assignment_id=p_assignment_id)
    then raise exception 'ASSIGNMENT_REPORT_ALREADY_SUBMITTED' using errcode='23505'; end if;

  for v_file in select value from jsonb_array_elements(p_files) loop
    v_count := v_count+1;
    v_path := v_file->>'path';
    v_name := v_file->>'name';
    v_mime := v_file->>'mime_type';
    v_size := (v_file->>'size_bytes')::bigint;
    if v_name is null or char_length(v_name) not between 1 and 255
      or v_mime not in ('image/png','image/jpeg','image/webp','application/pdf')
      or v_size not between 1 and 10485760
      or v_path !~* ('^'||v_test_id::text||'/'||v_user_id::text||'/'||p_assignment_id::text||'/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|pdf)$')
      or not exists (
        select 1 from storage.objects o
        where o.bucket_id='assignment-evidence' and o.name=v_path
      )
    then raise exception 'REPORT_EVIDENCE_INVALID' using errcode='22023'; end if;
    if (v_mime='image/png' and v_path !~* '\.png$')
      or (v_mime='image/jpeg' and v_path !~* '\.(jpg|jpeg)$')
      or (v_mime='image/webp' and v_path !~* '\.webp$')
      or (v_mime='application/pdf' and v_path !~* '\.pdf$')
    then raise exception 'REPORT_EVIDENCE_TYPE_MISMATCH' using errcode='22023'; end if;
  end loop;

  insert into public.assignment_submissions(assignment_id,test_id,tester_id,report_text,comments)
  values(p_assignment_id,v_test_id,v_user_id,btrim(p_report_text),coalesce(p_comments,''))
  returning id into v_submission_id;

  for v_file in select value from jsonb_array_elements(p_files) loop
    v_path := v_file->>'path';
    v_name := v_file->>'name';
    v_mime := v_file->>'mime_type';
    v_size := (v_file->>'size_bytes')::bigint;
    insert into public.assignment_submission_attachments(
      submission_id,assignment_id,test_id,tester_id,storage_path,original_filename,mime_type,size_bytes
    ) values (
      v_submission_id,p_assignment_id,v_test_id,v_user_id,v_path,v_name,v_mime,v_size
    );
  end loop;

  return jsonb_build_object('submission_id',v_submission_id,'status','submitted','attachments_count',v_count);
end;
$function$;

revoke all on function public.submit_assignment_report(uuid,text,text,jsonb) from public, anon;
grant execute on function public.submit_assignment_report(uuid,text,text,jsonb) to authenticated;

commit;
