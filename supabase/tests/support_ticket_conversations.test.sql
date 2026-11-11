begin;

select plan(9);

select ok(
  to_regclass('public.support_ticket_messages') is not null,
  'support conversation messages table exists'
);

select ok(
  to_regclass('public.support_ticket_attachments') is not null,
  'support attachment metadata table exists'
);

select ok(
  to_regclass('public.support_ticket_events') is not null,
  'support ticket audit events table exists'
);

select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.support_ticket_messages'::regclass),
  'support messages have row-level security enabled'
);

select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.support_ticket_attachments'::regclass),
  'support attachment metadata has row-level security enabled'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.support_tickets'::regclass
      and tgname = 'support_tickets_audit_insert'
      and not tgisinternal
      and (tgtype & 4) = 4
      and (tgtype & 2) = 0
  ),
  'ticket creation audit runs AFTER INSERT so its event foreign key is valid'
);

select ok(
  exists (
    select 1 from storage.buckets
    where id = 'support-attachments' and public = false
  ),
  'support attachments use a private storage bucket'
);

select ok(
  has_function_privilege('authenticated', 'private.is_support_staff()', 'EXECUTE')
  and not has_function_privilege('anon', 'private.is_support_staff()', 'EXECUTE'),
  'only authenticated sessions can execute the support-role helper'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'support_ticket_attachments'
      and policyname = 'support_ticket_attachments_insert_message_author'
      and qual is null
      and with_check like '%ticket_id%'
      and with_check like '%auth.uid%'
  ),
  'attachment metadata insert policy binds paths to the authenticated uploader'
);

select * from finish();

rollback;
