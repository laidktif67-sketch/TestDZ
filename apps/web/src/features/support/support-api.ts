import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

export function listDeveloperSupportTickets(userId: string) {
  return getClient()
    .from("support_tickets")
    .select("id,ticket_number,subject,category,priority,status,created_at,updated_at")
    .eq("user_id", userId)
    .eq("requester_role", "developer")
    .order("created_at", { ascending: false })
    .limit(50);
}

export function createDeveloperSupportTicket(values: {
  user_id: string;
  requester_role: "developer";
  subject: string;
  category: string;
  priority: string;
  description: string;
}) {
  return getClient()
    .from("support_tickets")
    .insert(values)
    .select("id,ticket_number,subject,category,priority,status,created_at,updated_at")
    .single();
}

export function getDeveloperSupportTicket(ticketId: string) {
  return getClient()
    .from("support_tickets")
    .select("id,ticket_number,user_id,requester_role,subject,category,priority,status,description,created_at,updated_at,resolved_at,resolved_by")
    .eq("id", ticketId)
    .eq("requester_role", "developer")
    .maybeSingle();
}

export function listDeveloperSupportMessages(ticketId: string) {
  return getClient()
    .from("support_ticket_messages")
    .select("id,ticket_id,sender_id,body,created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
}

export function listDeveloperSupportAttachments(ticketId: string) {
  return getClient()
    .from("support_ticket_attachments")
    .select("id,ticket_id,message_id,uploaded_by,storage_path,original_filename,mime_type,size_bytes,created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
}

export function listDeveloperSupportEvents(ticketId: string) {
  return getClient()
    .from("support_ticket_events")
    .select("id,ticket_id,actor_id,event_type,old_status,new_status,old_priority,new_priority,created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false });
}

export function createDeveloperSupportMessage(values: { ticket_id: string; sender_id: string; body: string }) {
  return getClient()
    .from("support_ticket_messages")
    .insert(values)
    .select("id")
    .single();
}

export function createDeveloperSupportAttachment(values: {
  ticket_id: string;
  message_id: string;
  uploaded_by: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
}) {
  return getClient()
    .from("support_ticket_attachments")
    .insert(values);
}
