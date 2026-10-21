import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { E2E_PASSWORD_ENV, loadLocalEnv, serviceClient, totpCode } from "./admin-auth";

// Playwright global setup (spec 0004, Configuration required): makes the test accounts on the
// local Supabase with the service role, promotes the admins with `pnpm admin:promote`, and enrolls
// an authenticator for the main admin through the API. The secret and password stay in this run's
// environment, never on disk. Without a local Supabase (CI today) the dashboard tests skip.

const ACCOUNTS = {
  admin: "e2e-admin@skf.test",
  enroll: "e2e-enroll@skf.test",
  customer: "e2e-customer@skf.test",
} as const;

const isLocal = (url: string | undefined) =>
  !!url && /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url);

async function reachable(url: string) {
  return fetch(`${url}/auth/v1/health`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })
    .then((response) => response.ok)
    .catch(() => false);
}

async function recreateUser(admin: SupabaseClient, email: string, password: string) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const old = data.users.find((user) => user.email === email);
  if (old) {
    const removed = await admin.auth.admin.deleteUser(old.id);
    if (removed.error) throw removed.error;
  }
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
}

function promote(email: string) {
  execSync(`pnpm admin:promote ${email}`, { stdio: "pipe" });
}

async function enrollAuthenticator(email: string, password: string): Promise<string> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  const enrolled = await client.auth.mfa.enroll({ factorType: "totp" });
  if (enrolled.error) throw enrolled.error;
  const secret = enrolled.data.totp.secret;
  const verified = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totpCode(secret),
  });
  if (verified.error) throw verified.error;
  await client.auth.signOut();
  return secret;
}

export default async function globalSetup() {
  loadLocalEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ready =
    isLocal(url) &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    (await reachable(url!));
  if (!ready) {
    console.warn("Skipping dashboard tests: local Supabase (pnpm db:start) is not reachable.");
    process.env.E2E_ADMIN_READY = "0";
    return;
  }

  const password = `e2e-${randomBytes(12).toString("hex")}`;
  const admin = serviceClient();
  for (const email of Object.values(ACCOUNTS)) await recreateUser(admin, email, password);
  promote(ACCOUNTS.admin);
  promote(ACCOUNTS.enroll);
  const secret = await enrollAuthenticator(ACCOUNTS.admin, password);

  Object.assign(process.env, {
    E2E_ADMIN_READY: "1",
    [E2E_PASSWORD_ENV]: password,
    E2E_ADMIN_EMAIL: ACCOUNTS.admin,
    E2E_ADMIN_TOTP_SECRET: secret,
    E2E_ENROLL_EMAIL: ACCOUNTS.enroll,
    E2E_CUSTOMER_EMAIL: ACCOUNTS.customer,
  });
}
