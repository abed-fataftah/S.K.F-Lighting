import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL_DIRECT;
if (!url) throw new Error("DATABASE_URL_DIRECT is not set (see .env.example).");

// Drizzle owns the public schema only; Supabase owns auth and storage.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema",
  out: "./drizzle",
  schemaFilter: ["public"],
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
