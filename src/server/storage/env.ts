import "server-only";
import { z } from "zod";

// The Storage admin settings (spec 0006, Security model). The service role key is read here only,
// on the server, and a missing or bad value fails loudly instead of uploading half configured.
const storageEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    protocol: /^https?$/,
    error: "NEXT_PUBLIC_SUPABASE_URL must be set (see .env.example).",
  }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ error: "SUPABASE_SERVICE_ROLE_KEY must be set (see .dev.vars.example)." })
    .min(20, "SUPABASE_SERVICE_ROLE_KEY must be set (see .dev.vars.example)."),
});

export type StorageEnv = { readonly url: string; readonly serviceRoleKey: string };

export function parseStorageEnv(env: Readonly<Record<string, string | undefined>>): StorageEnv {
  const parsed = storageEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  });
  return { url: parsed.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY };
}

export function storageEnv(): StorageEnv {
  return parseStorageEnv(process.env);
}
