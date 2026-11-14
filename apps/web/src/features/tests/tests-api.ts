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
