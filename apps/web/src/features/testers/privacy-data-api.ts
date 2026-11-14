import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Read-only account profile fields used to populate the privacy page. */
export function getPrivacyPageProfile(userId: string) {
  return getClient().from("profiles").select("display_name,avatar_url,created_at,updated_at").eq("id", userId).maybeSingle();
}

/** Full profile fields included in the user's account-data export. */
export function getPrivacyExportProfile(userId: string) {
  return getClient().from("profiles").select("display_name,avatar_url,bio,locale,phone,interests,subscription_tier,created_at,updated_at").eq("id", userId).maybeSingle();
}

/** Assignment records included in the full account-data export. */
export function listPrivacyExportAssignments(userId: string) {
  return getClient().from("assignments").select("id,test_id,status,start_date,completed_at,created_at,updated_at").eq("tester_id", userId);
}

/** Check-in records included in the full account-data export. */
export function listPrivacyExportCheckins(userId: string) {
  return getClient().from("checkins").select("id,assignment_id,checkin_date,note,created_at").eq("tester_id", userId);
}

/** Feedback records included in the full account-data export. */
export function listPrivacyExportFeedback(userId: string) {
  return getClient().from("feedback").select("id,assignment_id,rating,body,category,quality_status,created_at").eq("tester_id", userId);
}

/** Notification records included in the full account-data export. */
export function listPrivacyExportNotifications(userId: string) {
  return getClient().from("notifications").select("id,type,title,body,read_at,created_at").eq("user_id", userId);
}

/** Ledger records included in the full account-data export; this helper is read-only. */
export function listPrivacyExportLedger(userId: string) {
  return getClient().from("points_ledger").select("id,wallet_type,amount,reason,reference_type,created_at").eq("user_id", userId);
}

/** Activity assignments exported as CSV, preserving the original selected fields. */
export function listPrivacyActivityAssignments(userId: string) {
  return getClient().from("assignments").select("id,test_id,status,start_date,completed_at,created_at").eq("tester_id", userId);
}

/** Activity check-ins exported as CSV. */
export function listPrivacyActivityCheckins(userId: string) {
  return getClient().from("checkins").select("id,assignment_id,checkin_date,note,created_at").eq("tester_id", userId);
}

/** Activity feedback exported as CSV. */
export function listPrivacyActivityFeedback(userId: string) {
  return getClient().from("feedback").select("id,assignment_id,rating,category,quality_status,created_at").eq("tester_id", userId);
}

/** Activity ledger exported as CSV; no financial writes are performed here. */
export function listPrivacyActivityLedger(userId: string) {
  return getClient().from("points_ledger").select("id,wallet_type,amount,reason,created_at").eq("user_id", userId);
}
