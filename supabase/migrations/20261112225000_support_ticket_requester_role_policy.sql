-- Keep tester and developer support conversations isolated by requester role.
-- Also reconcile policies that may already exist in the linked database.

begin;

drop policy if exists support_tickets_insert_owner on public.support_tickets;
drop policy if exists support_tickets_insert_owner_role on public.support_tickets;
create policy support_tickets_insert_owner_role
on public.support_tickets for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'open'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and (ur.role = support_tickets.requester_role or ur.role = 'admin')
  )
);

drop policy if exists support_tickets_select_owner_or_support on public.support_tickets;
drop policy if exists support_tickets_select_owner_role_or_support on public.support_tickets;
create policy support_tickets_select_owner_role_or_support
on public.support_tickets for select to authenticated
using (
  (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = support_tickets.requester_role
    )
  )
  or (select private.is_support_staff())
);

drop policy if exists support_ticket_messages_select_participants
  on public.support_ticket_messages;
create policy support_ticket_messages_select_participants
on public.support_ticket_messages for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and (
        (
          t.user_id = (select auth.uid())
          and exists (
            select 1 from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.role = t.requester_role
          )
        )
        or (select private.is_support_staff())
      )
  )
);

drop policy if exists support_ticket_messages_insert_participants
  on public.support_ticket_messages;
create policy support_ticket_messages_insert_participants
on public.support_ticket_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and t.status <> 'closed'
      and (
        (
          t.user_id = (select auth.uid())
          and exists (
            select 1 from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.role = t.requester_role
          )
        )
        or (select private.is_support_staff())
      )
  )
);

drop policy if exists support_ticket_attachments_select_participants
  on public.support_ticket_attachments;
create policy support_ticket_attachments_select_participants
on public.support_ticket_attachments for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_attachments.ticket_id
      and (
        (
          t.user_id = (select auth.uid())
          and exists (
            select 1 from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.role = t.requester_role
          )
        )
        or (select private.is_support_staff())
      )
  )
);

drop policy if exists support_ticket_attachments_insert_message_author
  on public.support_ticket_attachments;
create policy support_ticket_attachments_insert_message_author
on public.support_ticket_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and storage_path like ticket_id::text || '/' || (select auth.uid())::text || '/%'
  and exists (
    select 1
    from public.support_ticket_messages m
    join public.support_tickets t on t.id = m.ticket_id
    where m.id = support_ticket_attachments.message_id
      and m.ticket_id = support_ticket_attachments.ticket_id
      and m.sender_id = (select auth.uid())
      and (
        (
          t.user_id = (select auth.uid())
          and exists (
            select 1 from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.role = t.requester_role
          )
        )
        or (select private.is_support_staff())
      )
  )
);

drop policy if exists support_ticket_events_select_participants
  on public.support_ticket_events;
create policy support_ticket_events_select_participants
on public.support_ticket_events for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_events.ticket_id
      and (
        (
          t.user_id = (select auth.uid())
          and exists (
            select 1 from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.role = t.requester_role
          )
        )
        or (select private.is_support_staff())
      )
  )
);

drop policy if exists support_attachments_insert_participants on storage.objects;
create policy support_attachments_insert_participants
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.support_tickets t
    where t.id = case
      when (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}
      and (
        (
          t.user_id = (select auth.uid())
          and exists (
            select 1 from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.role = t.requester_role
          )
        )
        or (select private.is_support_staff())
      )
      and t.status <> 'closed'
  )
);

drop policy if exists support_attachments_select_participants on storage.objects;
create policy support_attachments_select_participants
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and exists (
    select 1 from public.support_tickets t
    where t.id = ((storage.foldername(name))[1])::uuid
      and (
        (
          t.user_id = (select auth.uid())
          and exists (
            select 1 from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.role = t.requester_role
          )
        )
        or (select private.is_support_staff())
      )
  )
);

commit;

        then ((storage.foldername(name))[1])::uuid
      else null
    end
      and (
        (
          t.user_id = (select auth.uid())
          and exists (
            select 1 from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.role = t.requester_role
          )
        )
        or (select private.is_support_staff())
      )
      and t.status <> 'closed'
  )
);

drop policy if exists support_attachments_select_participants on storage.objects;
create policy support_attachments_select_participants
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and exists (
    select 1 from public.support_tickets t
    where t.id = case
      when (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}
      and (
        (
          t.user_id = (select auth.uid())
          and exists (
            select 1 from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.role = t.requester_role
          )
        )
        or (select private.is_support_staff())
      )
  )
);

commit;

        then ((storage.foldername(name))[1])::uuid
      else null
    end
      and (
        (
          t.user_id = (select auth.uid())
          and exists (
            select 1 from public.user_roles ur
            where ur.user_id = (select auth.uid())
              and ur.role = t.requester_role
          )
        )
        or (select private.is_support_staff())
      )
  )
);

commit;
