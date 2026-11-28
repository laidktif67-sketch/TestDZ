import { test, expect } from "@playwright/test";

const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
const TICKET_ID = "00000000-0000-4000-8000-000000000002";
const PUBLIC_MESSAGE_ID = "00000000-0000-4000-8000-000000000003";
const INTERNAL_MESSAGE_ID = "00000000-0000-4000-8000-000000000004";
const PUBLIC_ATTACHMENT_ID = "00000000-0000-4000-8000-000000000005";
const INTERNAL_ATTACHMENT_ID = "00000000-0000-4000-8000-000000000006";
const FUTURE_EXPIRY = 4102444800;
const ACCESS_TOKEN = [
  "eyJhbGciOiJub25lIiwidHlwIjoiSUpUIn0",
  "eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjQxMDI0NDQ4MDB9",
  "test-signature",
].join(".");

const ticket = {
  id: TICKET_ID, ticket_number: 42, user_id: TEST_USER_ID,
  requester_role: "tester", subject: "Evidence access request",
  category: "technical", priority: "normal", status: "open",
  description: "Please review the reported issue.", assigned_to: null,
  created_at: "2026-11-01T10:00:00.000Z",
  updated_at: "2026-11-01T10:00:00.000Z",
  resolved_at: null, resolved_by: null,
};
const publicMessage = {
  id: PUBLIC_MESSAGE_ID, ticket_id: TICKET_ID, sender_id: TEST_USER_ID,
  body: "Public conversation message", created_at: "2026-11-01T10:01:00.000Z",
};
const internalMessage = {
  id: INTERNAL_MESSAGE_ID, ticket_id: TICKET_ID, sender_id: TEST_USER_ID,
  body: "INTERNAL STAFF NOTE - MUST NOT BE VISIBLE", internal_note: true,
  created_at: "2026-11-01T10:02:00.000Z",
};
const publicAttachment = {
  id: PUBLIC_ATTACHMENT_ID, ticket_id: TICKET_ID, message_id: PUBLIC_MESSAGE_ID,
  uploaded_by: TEST_USER_ID, storage_path: "public/evidence.pdf",
  original_filename: "public-evidence.pdf", mime_type: "application/pdf",
  size_bytes: 1234, created_at: "2026-11-01T10:01:00.000Z",
};
const internalAttachment = {
  id: INTERNAL_ATTACHMENT_ID, ticket_id: TICKET_ID, message_id: INTERNAL_MESSAGE_ID,
  uploaded_by: TEST_USER_ID, storage_path: "internal/private-medical-record.pdf",
  original_filename: "INTERNAL-PRIVATE-MEDICAL-RECORD.pdf",
  mime_type: "application/pdf", size_bytes: 9876,
  created_at: "2026-11-01T10:02:00.000Z",
};

async function installSupportMocks(page) {
  await page.route("http://testdz-e2e.localhost:54321/**", async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        id: TEST_USER_ID, aud: "authenticated", role: "authenticated",
        email: "support-e2e@example.invalid",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {}, created_at: "2025-01-01T00:00:00.000Z",
      }) });
      return;
    }
    if (requestUrl.pathname === "/rest/v1/user_roles") {
      await route.fulfill({ status: 200, contentType: "application/json",
        headers: { "content-range": "0-0/1" }, body: JSON.stringify([{ role: "support" }]) });
      return;
    }
    if (requestUrl.pathname === "/rest/v1/support_tickets") {
      await route.fulfill({ status: 200, contentType: "application/json",
        headers: { "content-range": "0-0/1" }, body: JSON.stringify([ticket]) });
      return;
    }
    if (requestUrl.pathname === "/rest/v1/support_ticket_messages") {
      const excludesInternal = requestUrl.searchParams.get("internal_note") === "eq.false";
      const rows = excludesInternal ? [publicMessage] : [publicMessage, internalMessage];
      await route.fulfill({ status: 200, contentType: "application/json",
        headers: { "content-range": `0-${rows.length - 1}/${rows.length}` }, body: JSON.stringify(rows) });
      return;
    }
    if (requestUrl.pathname === "/rest/v1/support_ticket_events") {
      await route.fulfill({ status: 200, contentType: "application/json",
        headers: { "content-range": "0-0/1" }, body: JSON.stringify([]) });
      return;
    }
    if (requestUrl.pathname === "/rest/v1/support_ticket_attachments") {
      const messageFilter = requestUrl.searchParams.get("message_id") || "";
      const rows = messageFilter.includes(PUBLIC_MESSAGE_ID)
        ? [publicAttachment]
        : [publicAttachment, internalAttachment];
      await route.fulfill({ status: 200, contentType: "application/json",
        headers: { "content-range": `0-${rows.length - 1}/${rows.length}` }, body: JSON.stringify(rows) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await page.addInitScript(({ userId, token, expiresAt }) => {
    localStorage.setItem("sb-testdz-e2e-auth-token", JSON.stringify({
      access_token: token, refresh_token: "test-only-refresh-token",
      token_type: "bearer", expires_in: expiresAt - Math.floor(Date.now() / 1000),
      expires_at: expiresAt,
      user: {
        id: userId, aud: "authenticated", role: "authenticated",
        email: "support-e2e@example.invalid",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {}, created_at: "2025-01-01T00:00:00.000Z",
      },
    }));
  }, { userId: TEST_USER_ID, token: ACCESS_TOKEN, expiresAt: FUTURE_EXPIRY });
}

test("support ticket detail excludes internal notes and their private attachment metadata", async ({ page }) => {
  const requests = [];
  page.on("request", request => {
    if (request.url().includes("/rest/v1/support_ticket_messages") ||
        request.url().includes("/rest/v1/support_ticket_attachments")) {
      requests.push(request.url());
    }
  });
  await installSupportMocks(page);
  await page.goto(`/support/queue/${TICKET_ID}`);

  await expect(page.getByRole("heading", { name: "Evidence access request" })).toBeVisible();
  await expect(page.getByText("Public conversation message", { exact: true })).toBeVisible();
  await expect(page.getByText(/INTERNAL STAFF NOTE/)).toHaveCount(0);
  await expect(page.getByText(/INTERNAL-PRIVATE-MEDICAL-RECORD/)).toHaveCount(0);
  await expect(page.getByText("public-evidence.pdf")).toBeVisible();

  const messageRequest = requests.find(url => url.includes("/support_ticket_messages"));
  const attachmentRequest = requests.find(url => url.includes("/support_ticket_attachments"));
  expect(messageRequest, "support messages query was issued").toBeTruthy();
  expect(new URL(messageRequest).searchParams.get("internal_note")).toBe("eq.false");
  expect(attachmentRequest, "support attachment metadata query was issued").toBeTruthy();
  expect(new URL(attachmentRequest).searchParams.get("message_id")).toContain(PUBLIC_MESSAGE_ID);
  expect(new URL(attachmentRequest).searchParams.get("message_id")).not.toContain(INTERNAL_MESSAGE_ID);
});
