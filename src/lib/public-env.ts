import { z } from "zod";

// Public settings, inlined into the build (spec 0003). Read as literals so Next inlines them.
const publicEnvSchema = z.object({
  // Digits with country code, no plus or spaces (O-24). Moves to shop_settings in feature 26.
  NEXT_PUBLIC_WHATSAPP_NUMBER: z
    .string({ error: "NEXT_PUBLIC_WHATSAPP_NUMBER must be set (see .env.example)." })
    .regex(/^\d{8,15}$/, "NEXT_PUBLIC_WHATSAPP_NUMBER must be 8 to 15 digits, country code first."),
  // The shop's own address, used for links that leave the site, like the order link in W5 (spec 0004).
  NEXT_PUBLIC_SITE_URL: z
    .url({
      protocol: /^https?$/,
      error: "NEXT_PUBLIC_SITE_URL must be an absolute http(s) URL (see .env.example).",
    })
    .refine(
      (url) => !url.endsWith("/"),
      "NEXT_PUBLIC_SITE_URL must not end with a slash, for example https://skf.example.",
    ),
});

export type PublicEnv = { readonly whatsappNumber: string; readonly siteUrl: string };

export function parsePublicEnv(
  env: Readonly<Record<string, string | undefined>> = {
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
): PublicEnv {
  const parsed = publicEnvSchema.parse(env);
  return {
    whatsappNumber: parsed.NEXT_PUBLIC_WHATSAPP_NUMBER,
    siteUrl: parsed.NEXT_PUBLIC_SITE_URL,
  };
}
