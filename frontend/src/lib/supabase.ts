import { createClient } from "@supabase/supabase-js";

/**
 * TestDZ public client configuration.
 * Vite variables override these defaults for preview/staging deployments.
 * The publishable/anon key is intended for browser use; never put a service_role
 * or secret key in this file. Protect all exposed tables with Supabase RLS.
 */
const defaultSupabaseUrl = "https://naqjjykcglxiobkmdllj.supabase.co";
const defaultPublishableKey = "sb_publishable_Q0mu8NHBzQYz0M0GQ52gqw_dIomXgbu";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || defaultSupabaseUrl;
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() || defaultPublishableKey;

const hasValidUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl);
const hasPublicKey = supabaseKey.startsWith("sb_publishable_") || supabaseKey.startsWith("eyJ");

export const isSupabaseConfigured = hasValidUrl && hasPublicKey;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
