import postgres from "postgres";
import { loadLocalEnv } from "./admin-auth";

// A direct client on the local Supabase database, for flows that need many rows the UI would take
// minutes to make (spec 0008 AC-19: a category with more than one page of products). Local only:
// the flows that use it skip unless the dashboard accounts were set up on the local stack.
export function localSql() {
  loadLocalEnv();
  const url = process.env.DATABASE_URL_DIRECT;
  if (!url || !/@(127\.0\.0\.1|localhost):54322\//.test(url)) {
    throw new Error("localSql needs DATABASE_URL_DIRECT on the local Supabase database");
  }
  return postgres(url, { max: 1 });
}
