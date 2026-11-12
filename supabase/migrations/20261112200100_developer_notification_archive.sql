alter table public.notifications
  add column if not exists archived_at timestamptz;

create index if not exists notifications_user_role_archived_created_idx
  on public.notifications (user_id, recipient_role, archived_at, created_at desc);


create index if not exists notifications_user_archived_created_idx
  on public.notifications (user_id, archived_at, created_at desc);

comment on column public.notifications.archived_at is
  'Soft archive timestamp; archived notifications remain available for audit and can be restored by the owner.';
