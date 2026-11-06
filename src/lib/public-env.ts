import { z } from "zod";

// Public settings, inlined into the build (spec 0003). Read as literals so Next inlines them.
const publicEnvSchema = z.object({
  // Digits with country code, no plus or spaces (O-24). The fallback for shop_settings.whatsapp_number
  // (spec 0025 AC-4), and the only number the client error page can use.
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
  // Spec 0027: the Sentry project DSN. Unset turns Sentry off (local dev, CI check builds).
  NEXT_PUBLIC_SENTRY_DSN: z
    .url({ protocol: /^https?$/, error: "NEXT_PUBLIC_SENTRY_DSN must be the project DSN URL." })
    .optional(),
  // Spec 0027 AC-6: the Web Analytics site token. Unset leaves the beacon out.
  NEXT_PUBLIC_CF_BEACON_TOKEN: z
    .string()
    .regex(/^[\w-]+$/, "NEXT_PUBLIC_CF_BEACON_TOKEN must be the beacon token, letters and digits.")
    .optional(),
});

export type PublicEnv = {
  readonly whatsappNumber: string;
  readonly siteUrl: string;
  readonly sentryDsn: string | null;
  readonly cfBeaconToken: string | null;
};

export function parsePublicEnv(
  env: Readonly<Record<string, string | undefined>> = {
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_CF_BEACON_TOKEN: process.env.NEXT_PUBLIC_CF_BEACON_TOKEN,
  },
): PublicEnv {
  // An empty value counts as unset, like a blank line in `.env.example`.
  const parsed = publicEnvSchema.parse({
    ...env,
    NEXT_PUBLIC_SENTRY_DSN: env.NEXT_PUBLIC_SENTRY_DSN || undefined,
    NEXT_PUBLIC_CF_BEACON_TOKEN: env.NEXT_PUBLIC_CF_BEACON_TOKEN || undefined,
  });
  return {
    whatsappNumber: parsed.NEXT_PUBLIC_WHATSAPP_NUMBER,
    siteUrl: parsed.NEXT_PUBLIC_SITE_URL,
    sentryDsn: parsed.NEXT_PUBLIC_SENTRY_DSN ?? null,
    cfBeaconToken: parsed.NEXT_PUBLIC_CF_BEACON_TOKEN ?? null,
  };
}
