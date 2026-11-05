import "server-only";
import { z } from "zod";

// Server only settings (spec 0003). Each is parsed with Zod; a bad value fails loudly.
const serverEnvSchema = z.object({
  // "1" turns on the design system gallery at /design-system. Never set in production.
  DESIGN_SYSTEM_PAGE: z.enum(["0", "1"]).optional(),
});

export type ServerEnv = { readonly designSystemPage: boolean };

export function parseServerEnv(env: Readonly<Record<string, string | undefined>>): ServerEnv {
  const parsed = serverEnvSchema.parse({ DESIGN_SYSTEM_PAGE: env.DESIGN_SYSTEM_PAGE || undefined });
  return { designSystemPage: parsed.DESIGN_SYSTEM_PAGE === "1" };
}

export function serverEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
