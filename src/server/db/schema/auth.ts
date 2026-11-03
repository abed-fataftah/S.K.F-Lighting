import { pgSchema, text, uuid } from "drizzle-orm/pg-core";

// Stub of Supabase's auth.users so public tables can reference it, and the dashboard can read the
// email (spec 0019). Supabase owns this schema; drizzle.config.ts filters it out of migrations.
const auth = pgSchema("auth");

export const authUsers = auth.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
});
