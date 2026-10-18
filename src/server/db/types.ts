import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";
import type * as schema from "./schema";

/** A Drizzle client over postgres.js with the app schema, from `getDb()` or `getDirectDb()`. */
export type Database = PostgresJsDatabase<typeof schema> & { $client: Sql };

/** The `tx` handed to `db.transaction(async (tx) => ...)`. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
