import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Read only the profile fields used by developer settings; RLS remains authoritative. */
export function getDeveloperSettingsProfile(userId: string) {
  return getClient().from("profiles")
    .select("display_name,avatar_url,locale,bio")
    .eq("id", userId).maybeSingle();
}

/** Update editable developer profile preferences without changing identity or role fields. */
export function updateDeveloperSettingsProfile(userId: string, values: { display_name?: string; locale?: string }) {
  return getClient().from("profiles").update(values).eq("id", userId);
}

/** Read-only profile fields for the tester referral-history header. */
export function getTesterReferralProfile(userId: string) {
  return getClient().from("profiles")
    .select("display_name,avatar_url")
    .eq("id", userId).maybeSingle();
}
