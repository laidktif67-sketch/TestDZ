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


/** Data queries for the tester's My Tests overview. Auth/session handling stays in the page. */
export function listTesterMyTestRoles(userId: string) {
  return getClient().from("user_roles").select("role").eq("user_id", userId);
}



export function listTesterMyAssignments(userId: string) {
  return getClient().from("assignments")
    .select("id,status,start_date,completed_at,created_at,test:tests(id,title,status,end_date,app:apps(name,icon_url)),checkins(id,checkin_date,created_at)")
    .eq("tester_id", userId).order("created_at", { ascending: false });
}

export function listTesterMyFeedback(userId: string) {
  return getClient().from("feedback").select("id,quality_status,created_at,assignment_id")
    .eq("tester_id", userId).order("created_at", { ascending: false });
}

