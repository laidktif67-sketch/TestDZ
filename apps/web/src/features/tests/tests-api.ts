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
