import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Enable only after the rebuild_v2 schema has been deployed and exposed on the
// same Supabase project used by the active application environment.
// Keep this disabled in Production until the V2 cutover is explicitly approved.
export const isTesterWorkflowV2Enabled =
  import.meta.env.VITE_TESTER_WORKFLOW_V2_ENABLED === "true" && Boolean(supabase);

export const supabaseV2 = isTesterWorkflowV2Enabled && supabase
  ? (supabase as SupabaseClient<any>).schema("rebuild_v2")
  : null;
