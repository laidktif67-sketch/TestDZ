import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}


/** Read-only wallet balances; all financial mutations remain outside this module. */
export function getWalletRewardsWallet(userId: string) {
  return getClient().from("wallets").select("earned_points,purchased_credits").eq("user_id", userId).maybeSingle();
}

/** Read-only earned-points balance shared by tester overview pages. */
export function getTesterEarnedPointsWallet(userId: string) {
  return getClient().from("wallets").select("earned_points").eq("user_id", userId).maybeSingle();
}

/** Read-only recent ledger history; preserves the original ordering and 1,000-row window. */
export function listWalletRewardsLedger(userId: string) {
  return getClient().from("points_ledger")
    .select("id,wallet_type,amount,reason,reference_type,reference_id,created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).range(0, 999);
}

/** Count unread notifications for the signed-in tester. */
export function countWalletRewardsUnreadNotifications(userId: string) {
  return getClient().from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", userId).is("read_at", null);
}
