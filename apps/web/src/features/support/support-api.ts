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


/** Metadata for a public support-message attachment. File bytes stay in the private bucket. */
export type SupportTicketAttachment = {
  id: string;
  ticket_id: string;
  message_id: string;
  uploaded_by: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

/** Create a short-lived download URL; Storage RLS remains the authorization boundary. */
export function createSupportAttachmentDownloadUrl(storagePath: string) {
  return getAppDataClient().storage.from("support-attachments")
    .createSignedUrl(storagePath, 60, { download: true });
}

export type SupportQueueTicket = {
  id: string;
  ticket_number: number;
  user_id: string;
  requester_role: "tester" | "developer";
  subject: string;
  category: string;
  priority: "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_for_user" | "resolved" | "closed";
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

/** Read-only staff queue. Selects ticket metadata only; no description, message body or attachment data. */
export function listSupportQueueTickets() {
  return getAppDataClient().from("support_tickets")
    .select("id,ticket_number,user_id,requester_role,subject,category,priority,status,assigned_to,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);
}


export type SupportTicketDetail = {
  id: string;
  ticket_number: number;
  user_id: string;
  requester_role: "tester" | "developer";
  subject: string;
  category: string;
  priority: "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "waiting_for_user" | "resolved" | "closed";
  description: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type SupportTicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type SupportTicketEvent = {
  id: string;
  ticket_id: string;
  actor_id: string | null;
  event_type: "created" | "message_sent" | "status_changed" | "priority_changed";
  old_status: string | null;
  new_status: string | null;
  old_priority: string | null;
  new_priority: string | null;
  created_at: string;
};

/** Staff-only detail loader. Message bodies are limited to public conversation messages. */
export async function getSupportTicketDetails(ticketId: string) {
  const client = getAppDataClient();
  const ticketResult = await client.from("support_tickets")
    .select("id,ticket_number,user_id,requester_role,subject,category,priority,status,description,assigned_to,created_at,updated_at,resolved_at,resolved_by")
    .eq("id", ticketId).maybeSingle();
  if (ticketResult.error || !ticketResult.data) {
    return { ticketResult, messageResult: null, eventResult: null };
  }
  const [messageResult, eventResult] = await Promise.all([
    client.from("support_ticket_messages")
      .select("id,ticket_id,sender_id,body,created_at")
      .eq("ticket_id", ticketId).eq("internal_note", false)
      .order("created_at", { ascending: true }),
    client.from("support_ticket_events")
      .select("id,ticket_id,actor_id,event_type,old_status,new_status,old_priority,new_priority,created_at")
      .eq("ticket_id", ticketId).order("created_at", { ascending: true }),
  ]);
  if (messageResult.error) return { ticketResult, messageResult, eventResult, attachmentResult: null };
  const publicMessageIds = (messageResult.data ?? []).map((message: { id: string }) => message.id);
  const attachmentResult = publicMessageIds.length
    ? await client.from("support_ticket_attachments")
        .select("id,ticket_id,message_id,uploaded_by,storage_path,original_filename,mime_type,size_bytes,created_at")
        .eq("ticket_id", ticketId).in("message_id", publicMessageIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  return { ticketResult, messageResult, eventResult, attachmentResult };
}

/** Post a public staff reply through the audited V2 RPC. */
export function sendSupportStaffReply(ticketId: string, body: string) {
  return getAppDataClient().rpc("send_support_message", {
    p_ticket_id: ticketId,
    p_body: body,
  });
}

/** Update ticket status/priority with a mandatory reason; authorization is enforced by the database. */
export function updateSupportTicket(input: {
  ticketId: string;
  status: SupportTicketDetail["status"] | null;
  priority: SupportTicketDetail["priority"] | null;
  reason: string;
}) {
  return getAppDataClient().rpc("update_support_ticket", {
    p_ticket_id: input.ticketId,
    p_status: input.status,
    p_priority: input.priority,
    p_reason: input.reason,
  });
}
