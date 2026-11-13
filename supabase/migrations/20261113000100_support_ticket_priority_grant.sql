-- Allow support staff to update ticket priority while RLS and the audit trigger
-- continue to restrict the operation to authorized support/admin users.
begin;

grant update (priority) on public.support_tickets to authenticated;

commit;
