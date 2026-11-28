import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
  },
  webServer: {
    command: "npm run dev --workspace testdz-frontend -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: "http://testdz-e2e.localhost:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-only-publishable-key",
      VITE_TESTER_WORKFLOW_V2_ENABLED: "true",
    },
  },
});
