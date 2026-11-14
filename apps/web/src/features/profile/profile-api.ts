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


/** Read-only account settings fields for the tester settings page. */
export function getTesterAccountSettingsProfile(userId: string) {
  return getClient().from("profiles")
    .select("display_name,avatar_url,locale")
    .eq("id", userId).maybeSingle();
}

/** Update only editable tester profile preferences; identity and role fields remain untouched. */
export function updateTesterAccountSettingsProfile(userId: string, values: { display_name: string; locale: string }) {
  return getClient().from("profiles").update(values).eq("id", userId);
}


/** Update only the tester language preference; leave all other profile fields untouched. */
export function updateTesterLanguagePreference(userId: string, locale: string) {
  return getClient().from("profiles").update({ locale }).eq("id", userId);
}

/** Read-only profile header fields for tester notification preferences. */
export function getTesterNotificationPreferencesProfile(userId: string) {
  return getClient().from("profiles")
    .select("display_name,avatar_url")
    .eq("id", userId).maybeSingle();
}

/** Read-only profile header fields for the tester withdrawal status page. */
export function getTesterWithdrawalStatusProfile(userId: string) {
  return getClient().from("profiles")
    .select("display_name,avatar_url")
    .eq("id", userId).maybeSingle();
}
