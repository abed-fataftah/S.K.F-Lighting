// `pnpm media:sweep`: the weekly backstop for product files (spec 0006 AC-15). Removes every
// `products/<id>/` folder whose product no longer exists and whose newest file is more than a day
// old (a delete whose after commit cleanup failed, or uploads for a product never saved).
// Reads product ids as the `media_sweep` login (MEDIA_SWEEP_DATABASE_URL), falling back to
// DATABASE_URL_DIRECT locally, and talks to Storage with SUPABASE_SERVICE_ROLE_KEY.
// Logs counts and folder ids only. Exits non zero on any database or Storage error.
import { existsSync } from "node:fs";
import postgres from "postgres";
import { orphanFolders, type FolderAge } from "@/features/catalog/media-rules";
import {
  listProductFolder,
  listProductFolderIds,
  removeProductFolder,
} from "@/server/storage/admin";

const AT_ONCE = 5;

function loadEnv() {
  // Local runs read the same files as `next dev` and `pnpm preview`; set values win.
  for (const file of [".env.local", ".dev.vars"]) {
    if (!existsSync(file)) continue;
    const before = { ...process.env };
    process.loadEnvFile(file);
    Object.assign(process.env, before);
  }
}

/** Runs `work` over `items`, at most `limit` at a time, keeping the order of the results. */
async function inBatches<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    results.push(...(await Promise.all(items.slice(i, i + limit).map(work))));
  }
  return results;
}

async function productIds(): Promise<ReadonlySet<string>> {
  const url = process.env.MEDIA_SWEEP_DATABASE_URL || process.env.DATABASE_URL_DIRECT;
  if (!url) throw new Error("Set MEDIA_SWEEP_DATABASE_URL (or DATABASE_URL_DIRECT locally).");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const rows = await sql<{ id: string }[]>`select id from public.products`;
    return new Set(rows.map((row) => row.id));
  } finally {
    await sql.end();
  }
}

async function main() {
  loadEnv();
  const [ids, folders] = await Promise.all([productIds(), listProductFolderIds()]);
  const candidates = folders.filter((id) => !ids.has(id.toLowerCase()));

  const ages = await inBatches(candidates, AT_ONCE, async (productId): Promise<FolderAge> => {
    const files = await listProductFolder(productId);
    const times = files.flatMap((file) => (file.createdAt ? [file.createdAt.getTime()] : []));
    return { productId, newest: times.length ? new Date(Math.max(...times)) : null };
  });
  const orphans = orphanFolders(ages, ids, new Date());

  await inBatches(orphans, AT_ONCE, removeProductFolder);
  console.log(
    JSON.stringify({
      event: "media_sweep_done",
      folders: folders.length,
      removed: orphans.length,
      removedIds: orphans,
    }),
  );
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: "media_sweep_failed",
      error: error instanceof Error ? error.message : "unknown",
    }),
  );
  process.exitCode = 1;
});
