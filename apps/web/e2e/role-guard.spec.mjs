import { test, expect } from "@playwright/test";

const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";
const FUTURE_EXPIRY = 4102444800;
const ACCESS_TOKEN = [
  "eyJhbGciOiJub25lIiwidHlwIjoiSUpUIn0",
  "eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjQxMDI0NDQ4MDB9",
  "test-signature",
].join(".");

async function installSupabaseMocks(page, role) {
  await page.route("http://testdz-e2e.localhost:54321/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/rest/v1/user_roles") {
      const rows = role ? [{ role }] : [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify(rows),
      });
      return;
    }
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: TEST_USER_ID,
          aud: "authenticated",
          role: "authenticated",
          email: "e2e@example.invalid",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          created_at: "2025-01-01T00:00:00.000Z",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  if (role) {
    await page.addInitScript(({ userId, token, expiresAt }) => {
      localStorage.setItem("sb-testdz-e2e-auth-token", JSON.stringify({
        access_token: token,
        refresh_token: "test-only-refresh-token",
        token_type: "bearer",
        expires_in: expiresAt - Math.floor(Date.now() / 1000),
        expires_at: expiresAt,
        user: {
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          email: "e2e@example.invalid",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          created_at: "2025-01-01T00:00:00.000Z",
        },
      }));
    }, { userId: TEST_USER_ID, token: ACCESS_TOKEN, expiresAt: FUTURE_EXPIRY });
  }
}

test("anonymous visitor cannot enter a tester-only route", async ({ page }) => {
  await installSupabaseMocks(page, null);
  await page.goto("/tester-dashboard");
  await expect(page).toHaveURL(/\/auth$/);
});

test("tester can enter tester workspace and is redirected away from developer workspace", async ({ page }) => {
  await installSupabaseMocks(page, "tester");
  await page.goto("/tester-dashboard");
  await expect(page).toHaveURL(/\/tester-dashboard$/);

  await page.goto("/developer-dashboard");
  await expect(page).toHaveURL(/\/tester-dashboard$/);
});

test("developer can enter developer workspace and is redirected away from tester workspace", async ({ page }) => {
  await installSupabaseMocks(page, "developer");
  await page.goto("/developer-dashboard");
  await expect(page).toHaveURL(/\/developer-dashboard$/);

  await page.goto("/tester-dashboard");
  await expect(page).toHaveURL(/\/developer-dashboard$/);
});

test("support role can enter support ticket queue detail but not admin workspace", async ({ page }) => {
  await installSupabaseMocks(page, "support");
  await page.goto("/support/queue/00000000-0000-4000-8000-000000000002");
  await expect(page).toHaveURL(/\/support\/queue\/00000000-0000-4000-8000-000000000002$/);

  await page.goto("/admin/developer-reviews");
  await expect(page).toHaveURL(/\/profile$/);
});

test("admin role is allowed through protected admin and tester routes", async ({ page }) => {
  await installSupabaseMocks(page, "admin");
  await page.goto("/admin/developer-reviews");
  await expect(page).toHaveURL(/\/admin\/developer-reviews$/);

  await page.goto("/tester-dashboard");
  await expect(page).toHaveURL(/\/tester-dashboard$/);
});
