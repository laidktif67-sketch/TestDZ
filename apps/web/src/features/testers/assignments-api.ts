import { supabase } from "../../lib/supabase";

function getClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

/** Fetch only the signed-in tester's assignment details; existing RLS remains authoritative. */
export function getTesterAssignmentDetails(assignmentId: string, testerId: string) {
  return getClient().from("assignments")
    .select("id,status,start_date,points_awarded,test:tests(id,title,description,short_summary,start_date,end_date,app:apps(name,icon_url,category))")
    .eq("id", assignmentId)
    .eq("tester_id", testerId)
    .maybeSingle();
}
