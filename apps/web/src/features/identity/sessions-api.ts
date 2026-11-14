import { supabase } from "../../lib/supabase";

/** Calls the existing authenticated RPC; session ownership and authorization stay in Supabase. */
export function listMyActiveSessions() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase.rpc("get_my_active_sessions");
}
