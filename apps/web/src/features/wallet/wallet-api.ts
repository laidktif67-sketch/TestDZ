import { getAppDataClient } from "../../lib/supabase-data";
import { isTesterWorkflowV2Enabled } from "../../lib/supabase-v2";
import { profilesApi } from "../profiles/profiles-api";

/** Read wallet presentation data without touching V2 reward balances or ledger while rewards are disabled. */
export async function getWalletRewardsPageData(userId: string) {
  const client = getAppDataClient();
  const profileRes = await client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle();
  const noticeRes = await client.from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("recipient_role", "tester").is("read_at", null);
  if (isTesterWorkflowV2Enabled) {
    return {
      isV2: true as const, profileRes, walletRes: null, ledgerRes: null, noticeRes,
    };
  }
  const [walletRes, ledgerRes] = await Promise.all([
    client.from("wallets").select("earned_points,purchased_credits").eq("user_id", userId).maybeSingle(),
    client.from("points_ledger").select("id,wallet_type,amount,reason,reference_type,reference_id,created_at")
      .eq("user_id", userId).eq("wallet_type", "earned_points")
      .order("created_at", { ascending: false }).range(0, 999),
  ]);
  return { isV2: false as const, profileRes, walletRes, ledgerRes, noticeRes };
}

/** Legacy-only withdrawal preview data; the V2 withdrawal flow remains disabled. */
export async function getLegacyWithdrawalPageData(userId: string) {
  const client = getAppDataClient();
  const [profile, wallet] = await Promise.all([
    profilesApi.getHeaderProfile(userId),
    client.from("wallets").select("earned_points,purchased_credits").eq("user_id", userId).maybeSingle(),
  ]);
  return { profile, wallet };
}
