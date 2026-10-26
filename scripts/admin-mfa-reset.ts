// `pnpm admin:mfa-reset <email>`: for an owner who lost every authenticator device (spec 0004 AC-1,
// docs/runbooks/admin-mfa.md). Removes all of the user's MFA factors, then signs them out of every
// session, so nothing signed in with the old factor keeps working.
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; keep that key off shared machines.
import { existsSync } from "node:fs";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

function loadEnv() {
  // Local runs read the same files as `next dev` and `pnpm preview`; set values win.
  for (const file of [".env.local", ".dev.vars"]) {
    if (!existsSync(file)) continue;
    const before = { ...process.env };
    process.loadEnvFile(file);
    Object.assign(process.env, before);
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  }
  return parsed.data;
}

async function findUser(supabase: SupabaseClient, email: string): Promise<User | null> {
  const wanted = email.toLowerCase();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === wanted);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
}

/**
 * Supabase signs a user out everywhere only with one of their own tokens, so this opens one short
 * session through a magic link token (nothing is emailed) and ends every session from it.
 */
async function signOutEverywhere(supabase: SupabaseClient, email: string) {
  const link = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const session = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  });
  if (session.error || !session.data.session) throw session.error ?? new Error("No session");
  const out = await supabase.auth.admin.signOut(session.data.session.access_token, "global");
  if (out.error) throw out.error;
}

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error("Usage: pnpm admin:mfa-reset <email>");
    process.exitCode = 1;
    return;
  }
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const user = await findUser(supabase, email);
  if (!user) {
    console.error(`No account with the email ${email}.`);
    process.exitCode = 1;
    return;
  }

  const factors = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
  if (factors.error) throw factors.error;
  for (const factor of factors.data.factors) {
    const removed = await supabase.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id });
    if (removed.error) throw removed.error;
  }

  await signOutEverywhere(supabase, email);
  console.log(
    `Removed ${factors.data.factors.length} authenticator factor(s) for ${email} and signed them out everywhere. ` +
      "Sign in at /admin/login and set up the authenticator app on two devices again.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
