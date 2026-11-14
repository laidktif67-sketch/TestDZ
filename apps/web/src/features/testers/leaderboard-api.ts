import { supabase } from "../../lib/supabase";
import { listTesterProfilesByIds } from "./testers-api";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Read-only leaderboard queries; database policies remain authoritative. */
export function countTesterLeaderboardTesters() {
  return getClient().from("user_roles")
    .select("user_id", { count: "exact", head: true }).eq("role", "tester");
}

export function listTesterLeaderboardTesterIds() {
  return getClient().from("user_roles")
    .select("user_id").eq("role", "tester").limit(5000);
}

export function listTesterLeaderboardProfiles(userIds: string[]) {
  return listTesterProfilesByIds(userIds);
}

export function listTesterLeaderboardPoints(userIds: string[]) {
  return getClient().from("points_ledger")
    .select("user_id,amount,created_at,wallet_type,reason")
    .eq("wallet_type", "earned_points").in("user_id", userIds)
    .order("created_at", { ascending: false }).limit(20000);
}


export function listTesterLeaderboardLedger(userIds: string[]) {
  return getClient().from("points_ledger").select("user_id,amount")
    .eq("wallet_type", "earned_points").in("user_id", userIds).limit(20000);
}

export function listTesterLeaderboardCompletedAssignments(userIds: string[]) {
  return getClient().from("assignments")
    .select("tester_id,status").eq("status", "completed").in("tester_id", userIds);
}
