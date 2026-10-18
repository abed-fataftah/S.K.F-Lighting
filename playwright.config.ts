import { defineConfig, devices } from "@playwright/test";

// Spec 0001: CI runs these against `pnpm preview` (the real Workers runtime).
// Locally they run against `pnpm dev` unless E2E_TARGET=preview.
const onWorkers = process.env.E2E_TARGET === "preview" || !!process.env.CI;
const baseURL = onWorkers ? "http://localhost:8787" : "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: onWorkers ? "pnpm preview" : "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
