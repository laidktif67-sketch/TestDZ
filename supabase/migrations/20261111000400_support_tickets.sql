-- Dedicated support tickets; keep moderation reports semantically separate.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  ticket_number bigint generated always as identity unique,
  subject text not null check (char_length(trim(subject)) between 5 and 120),
  category text not null check (category in ('technical','account','testing','rewards','payments','other')),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  description text not null check (char_length(trim(description)) between 10 and 5000),
  status text not null default 'open' check (status in ('open','in_progress','waiting_for_user','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_user_created_idx on public.support_tickets(user_id, created_at desc);
alter table public.support_tickets enable row level security;
drop policy if exists support_tickets_select_owner_or_admin on public.support_tickets;
create policy support_tickets_select_owner_or_admin on public.support_tickets for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists support_tickets_insert_owner on public.support_tickets;
create policy support_tickets_insert_owner on public.support_tickets for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'open');
revoke all on public.support_tickets from anon, public;
grant select, insert on public.support_tickets to authenticated;
grant usage, select on sequence public.support_tickets_ticket_number_seq to authenticated;
