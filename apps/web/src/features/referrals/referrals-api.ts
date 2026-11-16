import { getUnreadNotificationCount } from "../notifications/notifications-api";
import { profilesApi } from "../profiles/profiles-api";
import { getAppDataClient } from "../../lib/supabase-data";

/** Load the referral pages' shared profile and unread-notification shell data. */
export async function getReferralPageShellData(userId: string) {
  const [profile, notifications] = await Promise.all([
    profilesApi.getHeaderProfile(userId),
    getUnreadNotificationCount(userId),
  ]);
  return { profile, notifications };
}

/** Read only referrals owned by the current referrer; reward posting stays disabled. */
export function getReferralHistory(userId: string) {
  return getAppDataClient().from("referrals")
    .select("id,referrer_id,referred_user_id,referral_code,status,created_at,qualified_at,rewarded_at")
    .eq("referrer_id", userId).order("created_at", { ascending: false });
}
