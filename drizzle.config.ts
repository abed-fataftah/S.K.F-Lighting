import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL_DIRECT;
if (!url) throw new Error("DATABASE_URL_DIRECT is not set (see .env.example).");

// Drizzle owns the public schema only; Supabase owns auth and storage.
export default defineConfig({
  dialect: "postgresql",
  // The public barrel, not the folder (which holds tests) or index.ts (which holds the auth stub).
  schema: "./src/server/db/schema/public.ts",
  out: "./drizzle",
  schemaFilter: ["public"],
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
