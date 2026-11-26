import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return respond(405, { error: "method_not_allowed" });
  }

  const dispatchSecret = Deno.env.get("NOTIFICATION_DISPATCH_SECRET") ?? "";
  const suppliedSecret = request.headers.get("x-dispatch-secret") ?? "";
  if (!dispatchSecret || !constantTimeEqual(suppliedSecret, dispatchSecret)) {
    return respond(401, { error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Notification dispatcher is missing Supabase server credentials.");
    return respond(503, { error: "dispatcher_not_configured" });
  }

  let limit = 50;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && "limit" in body) {
      limit = Number((body as { limit: unknown }).limit);
    }
  } catch {
    return respond(400, { error: "invalid_json" });
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return respond(400, { error: "invalid_batch_size" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .schema("rebuild_v2")
    .rpc("process_notification_outbox", { p_limit: limit });

  if (error) {
    console.error("Notification outbox dispatch failed:", error.code ?? "unknown");
    return respond(500, { error: "dispatch_failed" });
  }

  return respond(200, { processed: Number(data ?? 0) });
});
