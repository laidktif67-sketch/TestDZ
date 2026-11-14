import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Read-only points summary; wallet writes and financial rules remain elsewhere. */
export function getDiscoverWallet(userId: string) {
  return getClient().from("wallets").select("earned_points").eq("user_id", userId).maybeSingle();
}

/** Read-only assignment list used to count completed tests for this tester. */
export function listDiscoverAssignments(userId: string) {
  return getClient().from("assignments").select("id,status").eq("tester_id", userId);
}

/** Public recruiting opportunities only; the database RLS policy remains authoritative. */
export function listDiscoverAvailableTests() {
  return getClient().from("tests")
    .select("id,title,description,short_summary,status,min_testers,start_date,end_date,app:apps(name,icon_url,category)")
    .in("status", ["recruiting", "ready"])
    .order("created_at", { ascending: false }).limit(60);
}
