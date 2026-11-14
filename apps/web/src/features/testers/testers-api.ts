import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

export function listDeveloperTesterTests(developerId: string) {
  return getClient().from("tests").select("id,title,status").eq("developer_id", developerId);
}

export function listDeveloperTesterAssignments(testIds: string[]) {
  if (!testIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("assignments")
    .select("id,tester_id,test_id,status,created_at,updated_at,completed_at")
    .in("test_id", testIds).order("updated_at", { ascending: false }).limit(3000);
}

export function listDeveloperTesterProfiles(profileIds: string[]) {
  if (!profileIds.length) return Promise.resolve({ data: [], error: null });
  return getClient().from("profiles").select("id,display_name,avatar_url").in("id", profileIds);
}
