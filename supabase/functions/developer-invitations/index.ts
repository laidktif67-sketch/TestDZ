import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json; charset=utf-8",
};

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/") + "=";
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return bytes.length === 32 ? bytes : null;
  } catch {
    return null;
  }
}

async function createDeterministicToken(secret: string, userId: string, idempotencyKey: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const message = new TextEncoder().encode(userId + ":" + idempotencyKey);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const input = new Uint8Array(bytes.length);
  input.set(bytes);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", input.buffer as ArrayBuffer));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return respond(405, { error: "method_not_allowed" });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return respond(401, { error: "authentication_required" });
  const accessToken = match[1];

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    console.error("Developer invitation function is missing Supabase public server configuration.");
    return respond(503, { error: "service_not_configured" });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the JWT with Supabase Auth; never authorize from decoded client claims.
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return respond(401, { error: "invalid_session" });

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 8192) return respond(413, { error: "request_too_large" });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return respond(400, { error: "invalid_request" });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return respond(400, { error: "invalid_json" });
  }

  const action = body.action;
  if (action === "create") {
    const testId = body.test_id;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const idempotencyKey = body.idempotency_key;
    if (!isUuid(testId) || !isUuid(idempotencyKey) ||
        email.length < 6 || email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond(400, { error: "invalid_invitation_input" });
    }

    const tokenSecret = Deno.env.get("DEVELOPER_INVITATION_TOKEN_SECRET") ?? "";
    if (tokenSecret.length < 32) {
      console.error("Developer invitation token secret is not configured.");
      return respond(503, { error: "invitation_service_not_configured" });
    }
    // HMAC makes retries with the same authenticated user + idempotency key
    // reproduce the same token without ever persisting the raw token.
    const tokenBytes = await createDeterministicToken(tokenSecret, authData.user.id, idempotencyKey);
    const token = toBase64Url(tokenBytes);
    const tokenHash = bytesToHex(await sha256(tokenBytes));
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase.schema("rebuild_v2").rpc(
      "create_test_invitation",
      {
        p_test_id: testId,
        p_recipient_email: email,
        p_token_hash: `\\x${tokenHash}`,
        p_expires_at: expiresAt,
        p_idempotency_key: idempotencyKey,
      },
    );
    if (error) {
      console.warn("Invitation creation rejected:", error.code ?? "unknown");
      const status = error.code === "42501" ? 403 :
        error.code === "23505" ? 409 :
        error.code === "54000" ? 429 : 400;
      return respond(status, { error: "invitation_not_created" });
    }

    // This is the only response containing the raw capability token. No email is sent.
    return respond(201, {
      invitation_id: data,
      token,
      expires_at: expiresAt,
      delivery_status: "not_emailed",
      message: "Link ready — not emailed",
    });
  }

  if (action === "list") {
    if (!isUuid(body.test_id)) return respond(400, { error: "invalid_test_id" });
    const { data, error } = await supabase.schema("rebuild_v2").rpc(
      "list_test_invitations", { p_test_id: body.test_id },
    );
    if (error) {
      console.warn("Invitation list rejected:", error.code ?? "unknown");
      return respond(error.code === "42501" ? 403 : 400, { error: "invitation_list_unavailable" });
    }
    return respond(200, { invitations: data ?? [] });
  }

  if (action === "revoke") {
    if (!isUuid(body.invitation_id) || typeof body.reason !== "string" ||
        body.reason.trim().length < 5 || body.reason.trim().length > 500) {
      return respond(400, { error: "invalid_revocation_input" });
    }
    const { error } = await supabase.schema("rebuild_v2").rpc(
      "revoke_test_invitation",
      { p_invitation_id: body.invitation_id, p_reason: body.reason.trim() },
    );
    if (error) {
      console.warn("Invitation revocation rejected:", error.code ?? "unknown");
      return respond(error.code === "42501" ? 403 : 400, { error: "invitation_not_revoked" });
    }
    return respond(200, { revoked: true });
  }

  if (action === "redeem") {
    if (typeof body.token !== "string") return respond(400, { error: "invalid_invitation_token" });
    const tokenBytes = fromBase64Url(body.token);
    if (!tokenBytes) return respond(400, { error: "invalid_invitation_token" });
    const tokenHash = bytesToHex(await sha256(tokenBytes));
    const { data, error } = await supabase.schema("rebuild_v2").rpc(
      "redeem_test_invitation", { p_token_hash: `\\x${tokenHash}` },
    );
    if (error) {
      console.warn("Invitation redemption rejected:", error.code ?? "unknown");
      return respond(error.code === "42501" ? 403 : 400, { error: "invitation_not_redeemed" });
    }
    return respond(200, { assignment_id: data, redeemed: true });
  }

  return respond(400, { error: "unsupported_action" });
});
