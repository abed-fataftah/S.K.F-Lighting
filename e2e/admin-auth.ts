import { existsSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TOTP } from "otpauth";

// Shared helpers for the dashboard flows (spec 0004 AC-1, AC-16). The accounts come from
// `admin-setup.ts`, which passes them to the tests through environment variables.

export const E2E_PASSWORD_ENV = "E2E_ADMIN_PASSWORD";

/** Reads `.env.local` and `.dev.vars` without overriding what is already set. */
export function loadLocalEnv() {
  for (const file of [".env.local", ".dev.vars"]) {
    if (!existsSync(file)) continue;
    const before = { ...process.env };
    process.loadEnvFile(file);
    Object.assign(process.env, before);
  }
}

export type AdminAccounts = {
  readonly password: string;
  /** Admin with a verified authenticator; codes come from `secret`. */
  readonly admin: { readonly email: string; readonly secret: string };
  /** Admin with no authenticator yet, for the setup flow. */
  readonly enrollEmail: string;
  /** A customer account, refused by the dashboard. */
  readonly customerEmail: string;
};

/**
 * The accounts the setup made, or null when local Supabase was not reachable (CI today). Each
 * worker gets its own admin: when one session passes its code, Supabase Auth ends that user's other
 * sessions still waiting for a code, so a shared admin sends a parallel sign in back to login.
 */
export function adminAccounts(): AdminAccounts | null {
  const env = process.env;
  if (env.E2E_ADMIN_READY !== "1") return null;
  const slot = Number(env.TEST_PARALLEL_INDEX ?? 0) % Number(env.E2E_ADMIN_COUNT);
  return {
    password: env[E2E_PASSWORD_ENV]!,
    admin: {
      email: env[`E2E_ADMIN_EMAIL_${slot}`]!,
      secret: env[`E2E_ADMIN_TOTP_SECRET_${slot}`]!,
    },
    enrollEmail: env.E2E_ENROLL_EMAIL!,
    customerEmail: env.E2E_CUSTOMER_EMAIL!,
  };
}

/** A service role client for checks the UI cannot make (factor counts). Test code only. */
export function serviceClient() {
  loadLocalEnv();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const STEP_MS = 30_000;

/** The current code for a secret, or the one `steps` periods ahead. */
export function totpCode(secret: string, steps = 0): string {
  return new TOTP({ secret, digits: 6, period: 30 }).generate({
    timestamp: Date.now() + steps * STEP_MS,
  });
}

/** Email and password on /admin/login, then wait for the code page. */
export async function signInWithPassword(page: Page, email: string, password: string) {
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByTestId("admin-login-submit").click();
}

/**
 * Types a code made right before the submit; if Supabase refuses it (the 30 second step turned
 * over between making and checking), waits for the next step and tries once more.
 */
export async function enterCode(page: Page, secret: string, leaves: RegExp) {
  const field = page.getByLabel("الرمز من التطبيق");
  await field.fill(totpCode(secret));
  await page.getByTestId("admin-totp-submit").click();
  // Either the redirect (a slow first compile under `next dev` included) or the refusal banner.
  const outcome = await Promise.race([
    page.waitForURL(leaves, { timeout: 45_000 }).then(() => "left" as const),
    page
      .locator("#admin-totp-banner")
      .waitFor({ timeout: 45_000 })
      .then(() => "refused" as const),
  ]);
  if (outcome === "left") return;
  await page.waitForTimeout(STEP_MS - (Date.now() % STEP_MS) + 500);
  await field.fill(totpCode(secret));
  await page.getByTestId("admin-totp-submit").click();
  await expect(page).toHaveURL(leaves, { timeout: 15_000 });
}

/** The whole sign in: password, then a code, landing on `/admin/orders` (or `next`). */
export async function signInAdmin(page: Page, accounts: AdminAccounts, next?: string) {
  await page.goto(next ? `/admin/login?next=${encodeURIComponent(next)}` : "/admin/login");
  await signInWithPassword(page, accounts.admin.email, accounts.password);
  await expect(page).toHaveURL(/\/admin\/mfa/, { timeout: 45_000 });
  await enterCode(page, accounts.admin.secret, /\/admin\/(?!mfa|login)/);
}
