import { z } from "zod";

// Public settings, inlined into the build (spec 0003). Read as literals so Next inlines them.
const publicEnvSchema = z.object({
  // Digits with country code, no plus or spaces (O-24). Moves to shop_settings in feature 26.
  NEXT_PUBLIC_WHATSAPP_NUMBER: z
    .string({ error: "NEXT_PUBLIC_WHATSAPP_NUMBER must be set (see .env.example)." })
    .regex(/^\d{8,15}$/, "NEXT_PUBLIC_WHATSAPP_NUMBER must be 8 to 15 digits, country code first."),
});

export type PublicEnv = { readonly whatsappNumber: string };

export function parsePublicEnv(
  env: Readonly<Record<string, string | undefined>> = {
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  },
): PublicEnv {
  const parsed = publicEnvSchema.parse(env);
  return { whatsappNumber: parsed.NEXT_PUBLIC_WHATSAPP_NUMBER };
}
