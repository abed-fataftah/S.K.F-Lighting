import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Database } from "./types";

/**
 * A Drizzle client over `DATABASE_URL_DIRECT`, for scripts and database tests only.
 * The app never imports this: `getDb()` needs the Workers request context, this does not.
 * Close it with `await db.$client.end()`.
 */
export function getDirectDb(): Database {
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url) throw new Error("DATABASE_URL_DIRECT is not set (see .env.example).");
  return drizzle(postgres(url, { max: 10, onnotice: () => {} }), { schema });
}
