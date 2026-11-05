// `pnpm media:sweep`: the weekly backstop for product files (spec 0006 AC-15). Removes every
// `products/<id>/` folder whose product no longer exists and whose newest file is more than a day
// old (a delete whose after commit cleanup failed, or uploads for a product never saved). It also
// removes `banners/` and `categories/` files that no row points at and that are more than a day
// old (spec 0011 AC-13: closed dialogs and failed removals).
// Reads product ids and picture keys as the `media_sweep` login (MEDIA_SWEEP_DATABASE_URL), falling
// back to DATABASE_URL_DIRECT locally, and talks to Storage with SUPABASE_SERVICE_ROLE_KEY.
// Logs counts and folder ids only. Exits non zero on any database or Storage error.
import { existsSync } from "node:fs";
import postgres from "postgres";
import { homeImageLeftovers, orphanFolders, type FolderAge } from "@/features/catalog/media-rules";
import {
  listHomeImages,
  listProductFolder,
  listProductFolderIds,
  removeKeys,
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

/** Every product id, and every banner and category picture key a row still points at. */
async function storedRows(): Promise<{
  readonly productIds: ReadonlySet<string>;
  readonly pictureKeys: ReadonlySet<string>;
}> {
  const url = process.env.MEDIA_SWEEP_DATABASE_URL || process.env.DATABASE_URL_DIRECT;
  if (!url) throw new Error("Set MEDIA_SWEEP_DATABASE_URL (or DATABASE_URL_DIRECT locally).");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const products = await sql<{ id: string }[]>`select id from public.products`;
    const pictures = await sql<{ image_key: string }[]>`
      select image_key from public.banners
      union
      select image_key from public.categories where image_key is not null`;
    return {
      productIds: new Set(products.map((row) => row.id)),
      pictureKeys: new Set(pictures.map((row) => row.image_key)),
    };
  } finally {
    await sql.end();
  }
}

async function main() {
  loadEnv();
  const [{ productIds: ids, pictureKeys }, folders, bannerFiles, categoryFiles] = await Promise.all(
    [storedRows(), listProductFolderIds(), listHomeImages("banner"), listHomeImages("category")],
  );
  const candidates = folders.filter((id) => !ids.has(id.toLowerCase()));

  const ages = await inBatches(candidates, AT_ONCE, async (productId): Promise<FolderAge> => {
    const files = await listProductFolder(productId);
    const times = files.flatMap((file) => (file.createdAt ? [file.createdAt.getTime()] : []));
    return { productId, newest: times.length ? new Date(Math.max(...times)) : null };
  });
  const orphans = orphanFolders(ages, ids, new Date());

  await inBatches(orphans, AT_ONCE, removeProductFolder);
  const pictures = homeImageLeftovers([...bannerFiles, ...categoryFiles], pictureKeys, new Date());
  await removeKeys(pictures);
  console.log(
    JSON.stringify({
      event: "media_sweep_done",
      folders: folders.length,
      removed: orphans.length,
      removedIds: orphans,
      pictures: bannerFiles.length + categoryFiles.length,
      removedPictures: pictures.length,
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
