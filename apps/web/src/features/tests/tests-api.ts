import { supabase } from "../../lib/supabase";

export type CreateTestDraftInput = {
  appId: string;
  developerId: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  minTesters: number;
};

/**
 * Create a draft test using the existing tests table and RLS policies.
 * Keep the data-access boundary in the testing feature; callers remain
 * responsible for obtaining the authenticated user and validating form state.
 */
export function createTestDraft(input: CreateTestDraftInput) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  return supabase
    .from("tests")
    .insert({
      app_id: input.appId,
      developer_id: input.developerId,
      title: input.title,
      description: input.description,
      start_date: input.startDate,
      end_date: input.endDate,
      min_testers: input.minTesters,
      status: "draft",
    })
    .select("id")
    .single();
}


/** List the signed-in developer's tests; existing RLS remains authoritative. */
export function listDeveloperTests(developerId: string) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  return supabase
    .from("tests")
    .select("id,title,status,created_at,start_date,end_date,app:apps(name,icon_url)")
    .eq("developer_id", developerId)
    .order("created_at", { ascending: false })
    .limit(200);
}

/** List assignment summaries for tests owned by the developer. */
export function listDeveloperTestAssignments(developerId: string) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  return supabase
    .from("assignments")
    .select("test_id,tester_id,status,tests!inner(developer_id)")
    .eq("tests.developer_id", developerId);
}

/** Fetch a campaign owned by the developer; RLS remains authoritative. */
export function getDeveloperCampaign(testId: string, developerId: string) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  return supabase
    .from("tests")
    .select("id,title,description,status,created_at,start_date,end_date,min_testers,app:apps(id,name,package_name,icon_url,category)")
    .eq("id", testId)
    .eq("developer_id", developerId)
    .maybeSingle();
}

/** Load assignment rows for a campaign using the existing projection and ordering. */
export function listCampaignAssignments(testId: string) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  return supabase
    .from("assignments")
    .select("id,tester_id,status,created_at,updated_at,profile:profiles!assignments_tester_id_fkey(display_name,avatar_url)")
    .eq("test_id", testId)
    .order("updated_at", { ascending: false })
    .limit(500);
}

/** Load the latest feedback attached to assignments for this campaign. */
export function listCampaignFeedback(testId: string) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  return supabase
    .from("feedback")
    .select("id,body,rating,created_at,profile:profiles!feedback_tester_id_fkey(display_name,avatar_url),assignment:assignments!inner(test_id)")
    .eq("assignment.test_id", testId)
    .order("created_at", { ascending: false })
    .limit(8);
}

/** Load cohort recruitment flags and cohort summaries for a campaign. */
export function listCampaignCohorts(testId: string) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  return supabase
    .from("cohort_tests")
    .select("is_active,cohort:cohorts(capacity,name,status)")
    .eq("test_id", testId);
}

/** Update editable campaign fields without changing ownership or RLS checks. */
export function updateDeveloperCampaign(
  testId: string,
  developerId: string,
  values: { title: string; description: string | null; start_date: string | null; end_date: string | null; min_testers: number },
) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  return supabase
    .from("tests")
    .update(values)
    .eq("id", testId)
    .eq("developer_id", developerId)
    .select("id");
}

/** End a campaign using the existing cancelled status transition. */
export function endDeveloperCampaign(testId: string, developerId: string) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  return supabase
    .from("tests")
    .update({ status: "cancelled" })
    .eq("id", testId)
    .eq("developer_id", developerId)
    .select("id");
}

/** Pause or resume recruitment without changing campaign status. */
export function setDeveloperCampaignRecruitment(testId: string, isActive: boolean) {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  return supabase
    .from("cohort_tests")
    .update({ is_active: isActive })
    .eq("test_id", testId)
    .select("test_id");
}

