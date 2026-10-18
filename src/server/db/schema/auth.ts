import { pgSchema, uuid } from "drizzle-orm/pg-core";

// Stub of Supabase's auth.users so public tables can reference it.
// Supabase owns this schema; drizzle.config.ts filters it out of migrations.
const auth = pgSchema("auth");

export const authUsers = auth.table("users", {
  id: uuid("id").primaryKey(),
});
