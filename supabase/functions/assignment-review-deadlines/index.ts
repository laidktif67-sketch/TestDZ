import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { constantTimeEqual, readBoundedBody } from "./request-validation.ts";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return respond(405, { error: "METHOD_NOT_ALLOWED" });
  }

  const expectedSecret = Deno.env.get("ASSIGNMENT_REVIEW_DISPATCH_SECRET") ?? "";
  const suppliedSecret = request.headers.get("x-assignment-review-secret") ?? "";
  if (!expectedSecret) {
    console.error("Assignment review deadline worker is missing its dispatch secret.");
    return respond(503, { error: "WORKER_NOT_CONFIGURED" });
  }
  if (!constantTimeEqual(suppliedSecret, expectedSecret)) {
    return respond(401, { error: "UNAUTHORIZED" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Assignment review deadline worker is missing Supabase server credentials.");
    return respond(503, { error: "WORKER_NOT_CONFIGURED" });
  }

  let limit = 50;
  const boundedBody = await readBoundedBody(request);
  if (boundedBody.tooLarge) {
    return respond(413, { error: "REQUEST_BODY_TOO_LARGE" });
  }
  const rawBody = boundedBody.text;
  if (boundedBody.invalidUtf8) {
    return respond(400, { error: "INVALID_JSON" });
  }
  if (rawBody.trim()) {
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return respond(400, { error: "INVALID_JSON" });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return respond(400, { error: "INVALID_REQUEST_BODY" });
    }
    if ("limit" in body) {
      const parsed = Number((body as { limit: unknown }).limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        return respond(400, { error: "BATCH_SIZE_INVALID" });
      }
      limit = parsed;
    }
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client
    .schema("rebuild_v2")
    .rpc("process_assignment_review_deadlines", { p_limit: limit });

  if (error) {
    console.error("Assignment review deadline processing failed:", error.code ?? "unknown");
    return respond(500, { error: "DEADLINE_PROCESSING_FAILED" });
  }

  return respond(200, {
    ok: true,
    result: data ?? {
      reminders_queued: 0,
      auto_approved: 0,
      blocked_by_prerequisites: 0,
    },
  });
});
