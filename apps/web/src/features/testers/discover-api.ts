import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Read-only profile summary for the Discover Tests workspace. */
export function getDiscoverProfile(userId: string) {
  return getClient().from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle();
}

/** Read-only points summary; wallet writes and financial rules remain elsewhere. */
export function getDiscoverWallet(userId: string) {
  return getClient().from("wallets").select("earned_points").eq("user_id", userId).maybeSingle();
}

/** Read-only assignment list used to count completed tests for this tester. */
export function listDiscoverAssignments(userId: string) {
  return getClient().from("assignments").select("id,status").eq("tester_id", userId);
}

export function countDiscoverUnreadNotifications(userId: string) {
  return getClient().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
}

/** Public recruiting opportunities only; the database RLS policy remains authoritative. */
export function listDiscoverAvailableTests() {
  return getClient().from("tests")
    .select("id,title,description,short_summary,status,min_testers,start_date,end_date,app:apps(name,icon_url,category)")
    .in("status", ["recruiting", "ready"])
    .order("created_at", { ascending: false }).limit(60);
}
