import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { isTesterWorkflowV2Enabled, supabaseV2 } from "./supabase-v2";

/**
 * Central Data API selector.
 *
 * Auth and Storage remain on the base client (./supabase). Database table/RPC
 * calls must use this helper so the temporary legacy fallback can be removed
 * in one controlled cutover instead of being reimplemented across features.
 *
 * IMPORTANT: the legacy fallback is transitional and remains until every
 * application route has been migrated and the V2 cutover is approved.
 */
export function getAppDataClient(): SupabaseClient<any> {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");

  if (isTesterWorkflowV2Enabled) {
    if (!supabaseV2) throw new Error("SUPABASE_V2_NOT_CONFIGURED");
    return supabaseV2;
  }

  return supabase;
}

/** Base client for Supabase Auth and Storage only; do not use for app tables/RPCs. */
export function getSupabaseServiceClient() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}
