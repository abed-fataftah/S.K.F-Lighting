// `pnpm admin:promote <email>`: makes an existing account the shop's admin (spec 0004 AC-1).
// Uses DATABASE_URL_DIRECT (production: the session pooler URL). See docs/runbooks/admin-mfa.md.
import { existsSync } from "node:fs";
import { promoteMessage, promoteToAdmin } from "@/features/admin-auth/server/promote";
import { getDirectDb } from "@/server/db/direct";

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error("Usage: pnpm admin:promote <email>");
    process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASE_URL_DIRECT && existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }

  const db = getDirectDb();
  try {
    const outcome = await promoteToAdmin(db, email);
    const message = promoteMessage(outcome, email);
    if (outcome.kind === "promoted") {
      console.log(message);
    } else {
      console.error(message);
      process.exitCode = 1;
    }
  } finally {
    await db.$client.end();
  }
}

void main();
