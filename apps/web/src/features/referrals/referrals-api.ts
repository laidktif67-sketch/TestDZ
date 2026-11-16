import { getAppDataClient } from "../../lib/supabase-data";

/** Load the referral pages' shared profile and unread-notification shell data. */
export async function getReferralPageShellData(userId: string) {
  const client = getAppDataClient();
  const [profile, notifications] = await Promise.all([
    client.from("profiles").select("display_name,avatar_url").eq("id", userId).maybeSingle(),
    client.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", userId).is("read_at", null),
  ]);
  return { profile, notifications };
}

/** Read only referrals owned by the current referrer; reward posting stays disabled. */
export function getReferralHistory(userId: string) {
  return getAppDataClient().from("referrals")
    .select("id,referrer_id,referred_user_id,referral_code,status,created_at,qualified_at,rewarded_at")
    .eq("referrer_id", userId).order("created_at", { ascending: false });
}
