import { defineConfig, devices } from "@playwright/test";
import { STUB_ENV, STUB_PORT } from "./e2e/stubs/cf-graphql-data";

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
    {
      name: "phone",
      use: { ...devices["Pixel 7"] },
      testIgnore: /(rate-limit|homepage|shop-settings)\.spec\.ts/,
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      testIgnore: /(rate-limit|homepage|shop-settings)\.spec\.ts/,
    },
    // After them, alone: it changes Home's banners and featured products, which other flows read
    // (spec 0011 AC-16), and puts them back when it ends.
    {
      name: "homepage",
      use: { ...devices["Pixel 7"] },
      testMatch: /homepage\.spec\.ts/,
      dependencies: ["phone", "desktop"],
    },
    // After Home, alone: it changes the WhatsApp number, the delivery zones, and the policy pages
    // every flow reads (spec 0025), and puts them back when it ends.
    {
      name: "settings",
      use: { ...devices["Pixel 7"] },
      testMatch: /shop-settings\.spec\.ts/,
      dependencies: ["homepage"],
    },
    // Last, alone: its submits spend the order allowance of the shared local IP (spec 0004 AC-10).
    {
      name: "rate-limit",
      use: { ...devices["Pixel 7"] },
      testMatch: /rate-limit\.spec\.ts/,
      dependencies: ["settings"],
    },
  ],
  webServer: [
    // The Web Analytics stand in the stats page reads (spec 0027). Under `pnpm preview` the Worker
    // gets STUB_ENV from .dev.vars (see .dev.vars.example and CI); `pnpm dev` gets it here.
    {
      command: "pnpm exec tsx e2e/stubs/cf-graphql.ts",
      url: `http://127.0.0.1:${STUB_PORT}/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: onWorkers ? "pnpm preview" : "pnpm dev",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: onWorkers ? {} : STUB_ENV,
    },
  ],
});
