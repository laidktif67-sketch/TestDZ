import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

export function listDeveloperFeedback(developerId: string) {
  return getClient()
    .from("feedback")
    .select("id,assignment_id,tester_id,rating,body,category,quality_status,created_at,assignment:assignments!inner(test:tests!inner(id,title,developer_id,app:apps(name,icon_url))),developer_review:developer_feedback_reviews(status,resolution_note,updated_at),tester:profiles!feedback_tester_id_fkey(display_name,avatar_url)")
    .eq("assignment.test.developer_id", developerId)
    .order("created_at", { ascending: false })
    .limit(1000);
}

export function getDeveloperFeedbackDetails(feedbackId: string, developerId: string) {
  return getClient()
    .from("feedback")
    .select("id,assignment_id,tester_id,rating,body,category,quality_status,created_at,assignment:assignments!inner(test:tests!inner(id,title,developer_id,app:apps(id,name,icon_url,package_name))),tester:profiles!feedback_tester_id_fkey(display_name,avatar_url)")
    .eq("id", feedbackId)
    .eq("assignment.test.developer_id", developerId)
    .maybeSingle();
}

export function getDeveloperFeedbackReview(feedbackId: string, options?: { includeId?: boolean }) {
  const query = getClient().from("developer_feedback_reviews");
  return options?.includeId
    ? query.select("id,status,priority").eq("feedback_id", feedbackId).maybeSingle()
    : query.select("status,priority").eq("feedback_id", feedbackId).maybeSingle();
}

export function listDeveloperFeedbackMessages(feedbackId: string) {
  return getClient()
    .from("developer_feedback_messages")
    .select("id,feedback_id,sender_id,body,created_at,sender:profiles!developer_feedback_messages_sender_id_fkey(display_name,avatar_url)")
    .eq("feedback_id", feedbackId)
    .order("created_at");
}

export function listDeveloperFeedbackAttachments(feedbackId: string) {
  return getClient()
    .from("developer_feedback_attachments")
    .select("id,message_id,storage_path,original_filename,mime_type,size_bytes,created_at")
    .eq("feedback_id", feedbackId)
    .order("created_at", { ascending: false });
}

export function listDeveloperFeedbackEvents(feedbackId: string) {
  return getClient()
    .from("developer_feedback_events")
    .select("id,actor_id,event_type,old_value,new_value,created_at")
    .eq("feedback_id", feedbackId)
    .order("created_at", { ascending: false });
}

export function updateDeveloperFeedbackReview(feedbackId: string, values: { status?: string; priority?: string; resolution_note?: string | null }) {
  return getClient()
    .from("developer_feedback_reviews")
    .update(values)
    .eq("feedback_id", feedbackId);
}

export function createDeveloperFeedbackReview(values: { feedback_id: string; developer_id: string; status?: string; priority?: string; resolution_note?: string | null }) {
  return getClient()
    .from("developer_feedback_reviews")
    .insert(values)
    .select("id")
    .maybeSingle();
}

export function createDeveloperFeedbackMessage(values: { feedback_id: string; sender_id: string; body: string }) {
  return getClient()
    .from("developer_feedback_messages")
    .insert(values)
    .select("id")
    .single();
}

export function createFeedbackAttachmentMetadata(values: { feedback_id: string; message_id: string; uploaded_by: string; storage_path: string; original_filename: string; mime_type: string; size_bytes: number }) {
  return getClient()
    .from("developer_feedback_attachments")
    .insert(values);
}

/** Tester profile fields used by the feedback-history header. */
export function getTesterFeedbackProfile(userId: string) {
  return getClient().from("profiles")
    .select("display_name,avatar_url")
    .eq("id", userId)
    .maybeSingle();
}

/** Feedback rows and related test/app display data for a tester's own history. */
export function listTesterFeedbackHistory(testerId: string) {
  return getClient().from("feedback")
    .select("id,assignment_id,rating,body,category,quality_status,reviewed_at,created_at,assignment:assignments(id,test:tests(id,title,app:apps(name,icon_url)))")
    .eq("tester_id", testerId)
    .order("created_at", { ascending: false });
}

/** Existing earned-points ledger rows used to display feedback rewards. */
export function listTesterFeedbackRewards(userId: string) {
  return getClient().from("points_ledger")
    .select("amount,reference_id,reference_type")
    .eq("user_id", userId)
    .eq("wallet_type", "earned_points");
}
