import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-assignment-review-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const expectedSecret = Deno.env.get("ASSIGNMENT_REVIEW_DISPATCH_SECRET");
  const suppliedSecret = request.headers.get("x-assignment-review-secret");
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return json(401, { error: "DISPATCH_SECRET_INVALID" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { error: "SERVER_CONFIGURATION_MISSING" });
  }

  let limit = 50;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && body.limit !== undefined) {
      const parsed = Number(body.limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        return json(400, { error: "BATCH_SIZE_INVALID" });
      }
      limit = parsed;
    }
  } catch {
    return json(400, { error: "REQUEST_BODY_INVALID" });
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client
    .schema("rebuild_v2")
    .rpc("process_assignment_review_deadlines", { p_limit: limit });

  if (error) {
    return json(500, { error: "DEADLINE_PROCESSING_FAILED", detail: error.message });
  }

  return json(200, { ok: true, result: data ?? { reminders_sent: 0, auto_approved: 0, blocked_by_prerequisites: 0 } });
});
