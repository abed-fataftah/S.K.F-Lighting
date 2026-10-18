import "server-only";
import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * One Drizzle client per request, built from the Hyperdrive binding.
 * Never hold a client at module level: Workers cannot share I/O across requests.
 * Transactions are fine; session features (LISTEN, session advisory locks) are not.
 */
export const getDb = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });
  const sql = postgres(env.HYPERDRIVE.connectionString, {
    max: 1,
    prepare: false,
    fetch_types: false,
  });
  return drizzle(sql, { schema });
});

export type Db = Awaited<ReturnType<typeof getDb>>;
