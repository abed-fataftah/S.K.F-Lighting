// `pnpm db:backfill-search`: recomputes `products.search_text` and `product_variants.size_key` for
// every product (spec 0010 AC-7), writing only the rows whose value differs, and prints how many it
// changed. Idempotent: a second run changes 0 rows. CI runs it right after each production deploy;
// run it locally after `pnpm db:migrate`. Uses DATABASE_URL_DIRECT. Logs counts only.
import { existsSync } from "node:fs";
import { backfillSearchKeys } from "@/features/catalog/server/search-keys";
import { getDirectDb } from "@/server/db/direct";

async function main() {
  if (!process.env.DATABASE_URL_DIRECT && existsSync(".env.local")) {
    process.loadEnvFile(".env.local");
  }
  const db = getDirectDb();
  try {
    const changed = await backfillSearchKeys(db);
    console.log(
      `Search keys backfilled: ${changed.products} products and ${changed.options} options changed.`,
    );
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error("backfill-search failed", {
    error: error instanceof Error ? error.name : "unknown",
  });
  process.exitCode = 1;
});
