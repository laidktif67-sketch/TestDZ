import { test, expect } from "@playwright/test";

const TESTER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_TESTER_ID = "00000000-0000-4000-8000-000000000002";
const ASSIGNMENT_ID = "00000000-0000-4000-8000-000000000003";
const OTHER_ASSIGNMENT_ID = "00000000-0000-4000-8000-000000000004";
const REQUEST_ID = "00000000-0000-4000-8000-000000000005";
const EXPIRY = 4102444800;
const TOKEN = [
  "eyJhbGciOiJub25lIiwidHlwIjoiSUpUIn0",
  "eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjQxMDI0NDQ4MDB9",
  "test-signature",
].join(".");

async function installIdentity(page, role) {
  await page.route("http://testdz-e2e.localhost:54321/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        id: TESTER_ID, aud: "authenticated", role: "authenticated",
        email: "medical-e2e@example.invalid",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {}, created_at: "2025-01-01T00:00:00.000Z",
      }) });
      return;
    }
    if (url.pathname === "/rest/v1/user_roles") {
      await route.fulfill({ status: 200, contentType: "application/json",
        headers: { "content-range": "0-0/1" }, body: JSON.stringify([{ role }]) });
      return;
    }
    if (url.pathname === "/rest/v1/assignments") {
      const scopedToOwner = url.searchParams.get("tester_id") === `eq.${TESTER_ID}`;
      const requestedAssignment = url.searchParams.get("id");
      const rows = scopedToOwner && requestedAssignment === `eq.${ASSIGNMENT_ID}`
        ? [{ id: ASSIGNMENT_ID, status: "active" }]
        : [];
      await route.fulfill({ status: 200, contentType: "application/json",
        headers: { "content-range": `0-${rows.length - 1}/${rows.length}` }, body: JSON.stringify(rows) });
      return;
    }
    if (url.pathname === "/rest/v1/medical_exception_requests") {
      const scoped = url.searchParams.get("assignment_id") === `eq.${ASSIGNMENT_ID}`;
      const rows = scoped ? [{
        id: REQUEST_ID, assignment_id: ASSIGNMENT_ID,
        reason: "Private medical context for this tester's own assignment.",
        requested_dates: ["2026-11-27"], status: "pending",
        review_note: null, created_at: "2026-11-27T10:00:00.000Z",
        evidence_storage_path: null,
      }] : [{
        id: "00000000-0000-4000-8000-000000000006",
        assignment_id: OTHER_ASSIGNMENT_ID,
        reason: "OTHER TESTER PRIVATE MEDICAL REQUEST - MUST NOT APPEAR",
        requested_dates: ["2026-11-27"], status: "pending",
        review_note: null, created_at: "2026-11-27T10:00:00.000Z",
        evidence_storage_path: null,
      }];
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
        email: "medical-e2e@example.invalid",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {}, created_at: "2025-01-01T00:00:00.000Z",
      },
    }));
  }, { userId: TESTER_ID, token: TOKEN, expiresAt: EXPIRY });
}

test("tester medical exception history is scoped to the tester's own assignment", async ({ page }) => {
  const requests = [];
  page.on("request", request => {
    if (request.url().includes("/rest/v1/assignments") ||
        request.url().includes("/rest/v1/medical_exception_requests")) requests.push(request.url());
  });
  await installIdentity(page, "tester");
  await page.goto(`/assignments/${ASSIGNMENT_ID}/medical-exception`);

  await expect(page.getByRole("heading", { name: "Medical exception request" })).toBeVisible();
  await expect(page.getByText("Private medical context for this tester's own assignment.", { exact: true })).toBeVisible();
  await expect(page.getByText(/OTHER TESTER PRIVATE MEDICAL REQUEST/)).toHaveCount(0);

  const assignmentQuery = requests.find(url => url.includes("/rest/v1/assignments"));
  const requestQuery = requests.find(url => url.includes("/rest/v1/medical_exception_requests"));
  expect(assignmentQuery).toBeTruthy();
  expect(new URL(assignmentQuery).searchParams.get("id")).toBe(`eq.${ASSIGNMENT_ID}`);
  expect(new URL(assignmentQuery).searchParams.get("tester_id")).toBe(`eq.${TESTER_ID}`);
  expect(requestQuery).toBeTruthy();
  expect(new URL(requestQuery).searchParams.get("assignment_id")).toBe(`eq.${ASSIGNMENT_ID}`);
});

test("non-tester role cannot open the medical exception workspace", async ({ page }) => {
  const medicalRequests = [];
  page.on("request", request => {
    if (request.url().includes("/rest/v1/medical_exception_requests")) medicalRequests.push(request.url());
  });
  await installIdentity(page, "developer");
  await page.goto(`/assignments/${ASSIGNMENT_ID}/medical-exception`);

  await expect(page).toHaveURL(/\/developer-dashboard$/);
  await expect(page.getByRole("heading", { name: "Medical exception request" })).toHaveCount(0);
  expect(medicalRequests).toHaveLength(0);
});

test("tester cannot load medical history for another tester's assignment", async ({ page }) => {
  const medicalRequests = [];
  page.on("request", request => {
    if (request.url().includes("/rest/v1/medical_exception_requests")) medicalRequests.push(request.url());
  });
  await installIdentity(page, "tester");
  await page.goto(`/assignments/${OTHER_ASSIGNMENT_ID}/medical-exception`);

  await expect(page.getByText("This assignment could not be found in your Tester workspace.")).toBeVisible();
  await expect(page.getByText(/OTHER TESTER PRIVATE MEDICAL REQUEST/)).toHaveCount(0);
  expect(medicalRequests).toHaveLength(0);
});
