import { defineConfig, devices } from "@playwright/test";

// Spec 0001: CI runs these against `pnpm preview` (the real Workers runtime).
// Locally they run against `pnpm dev` unless E2E_TARGET=preview.
const onWorkers = process.env.E2E_TARGET === "preview" || !!process.env.CI;
const baseURL = onWorkers ? "http://localhost:8787" : "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // Dashboard test accounts on the local Supabase (spec 0004); the tests skip without it.
  globalSetup: "./e2e/admin-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] }, testIgnore: /rate-limit\.spec\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      testIgnore: /rate-limit\.spec\.ts/,
    },
    // Last, alone: its submits spend the order allowance of the shared local IP (spec 0004 AC-10).
    {
      name: "rate-limit",
      use: { ...devices["Pixel 7"] },
      testMatch: /rate-limit\.spec\.ts/,
      dependencies: ["phone", "desktop"],
    },
  ],
  webServer: {
    command: onWorkers ? "pnpm preview" : "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
