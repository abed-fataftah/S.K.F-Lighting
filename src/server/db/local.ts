// The local Supabase database from `pnpm db:start`. Seeds and database tests only ever touch it.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_PORT = "54322";

/** True only for a postgres URL on localhost or 127.0.0.1, port 54322. */
export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const isPostgres = parsed.protocol === "postgresql:" || parsed.protocol === "postgres:";
    return isPostgres && LOCAL_HOSTS.has(parsed.hostname) && parsed.port === LOCAL_PORT;
  } catch {
    return false;
  }
}
