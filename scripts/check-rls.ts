// `pnpm db:check-rls`: fails when any public table lacks RLS or the browser roles can use anything
// in the public schema (spec 0002, AC-2). Runs against DATABASE_URL_DIRECT.
import { existsSync } from "node:fs";
import { getDirectDb } from "@/server/db/direct";
import { findRlsProblems } from "@/server/db/rls-check";

async function main() {
  if (!process.env.DATABASE_URL_DIRECT && existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }
  const db = getDirectDb();
  try {
    const problems = await findRlsProblems(db);
    if (problems.length === 0) {
      console.log(
        "RLS check passed: every public table has RLS, and anon and authenticated can use nothing.",
      );
      return;
    }
    console.error(`RLS check failed, ${problems.length} problem(s):`);
    for (const p of problems) {
      console.error(`  ${p.kind}  ${p.object}${p.role ? `  (${p.role})` : ""}`);
    }
    process.exitCode = 1;
  } finally {
    await db.$client.end();
  }
}

void main();
