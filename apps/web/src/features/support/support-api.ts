import { getAppDataClient } from "../../lib/supabase-data";
import { isTesterWorkflowV2Enabled } from "../../lib/supabase-v2";

/** List the signed-in tester's support tickets. */
export async function getTesterSupportTickets(userId: string) {
  return getAppDataClient().from("support_tickets")
    .select("id,ticket_number,subject,category,priority,status,created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
}

/** Create a support ticket using the guarded V2 workflow or legacy fallback. */
export async function createTesterSupportTicket(input: {
  userId: string; subject: string; category: string; priority: string; description: string;
}) {
  const client = getAppDataClient();
  if (isTesterWorkflowV2Enabled) {
    return client.rpc("create_support_ticket", {
      p_subject: input.subject, p_category: input.category,
      p_priority: input.priority, p_description: input.description,
    });
  }
  return client.from("support_tickets").insert({
    user_id: input.userId, subject: input.subject, category: input.category,
    priority: input.priority, description: input.description,
  }).select("id,ticket_number,subject,category,priority,status,created_at").single();
}

/** Load a ticket and its conversation/attachment metadata under database RLS. */
export async function getTesterSupportTicketDetails(ticketId: string) {
  const client = getAppDataClient();
  const ticketResult = await client.from("support_tickets")
    .select("id,ticket_number,user_id,subject,category,priority,status,description,created_at,updated_at,resolved_at,resolved_by")
    .eq("id", ticketId).maybeSingle();
  if (ticketResult.error || !ticketResult.data) {
    return { ticketResult, messageResult: null, attachmentResult: null };
  }
  const [messageResult, attachmentResult] = await Promise.all([
    client.from("support_ticket_messages").select("id,ticket_id,sender_id,body,created_at")
      .eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    client.from("support_ticket_attachments").select("id,ticket_id,message_id,uploaded_by,storage_path,original_filename,mime_type,size_bytes,created_at")
      .eq("ticket_id", ticketId).order("created_at", { ascending: true }),
  ]);
  return { ticketResult, messageResult, attachmentResult };
}

/** Send a reply using the V2 support RPC or the isolated legacy insert fallback. */
export async function sendTesterSupportMessage(ticketId: string, userId: string, body: string) {
  const client = getAppDataClient();
  if (isTesterWorkflowV2Enabled) {
    return client.rpc("send_support_message", { p_ticket_id: ticketId, p_body: body });
  }
  return client.from("support_ticket_messages")
    .insert({ ticket_id: ticketId, sender_id: userId, body }).select("id").single();
}

/** Register uploaded support attachment metadata; file bytes remain in Supabase Storage. */
export async function addTesterSupportAttachment(input: {
  ticketId: string; messageId: string; userId: string; storagePath: string;
  filename: string; mimeType: string; sizeBytes: number;
}) {
  const client = getAppDataClient();
  if (isTesterWorkflowV2Enabled) {
    return client.rpc("add_support_attachment", {
      p_ticket_id: input.ticketId, p_message_id: input.messageId,
      p_storage_path: input.storagePath, p_original_filename: input.filename,
      p_mime_type: input.mimeType, p_size_bytes: input.sizeBytes,
    });
  }
  return client.from("support_ticket_attachments").insert({
    ticket_id: input.ticketId, message_id: input.messageId, uploaded_by: input.userId,
    storage_path: input.storagePath, original_filename: input.filename,
    mime_type: input.mimeType, size_bytes: input.sizeBytes,
  });
}
