import "server-only";
import { z } from "zod";

// Server only settings (spec 0003). Each is parsed with Zod; a bad value fails loudly.
const serverEnvSchema = z.object({
  // "1" turns on the design system gallery at /design-system. Never set in production.
  DESIGN_SYSTEM_PAGE: z.enum(["0", "1"]).optional(),
  // Spec 0027: the Web Analytics read. All three or none; none shows the "not set up" notice.
  CF_ACCOUNT_ID: z.string().optional(),
  CF_WEB_ANALYTICS_SITE_TAG: z.string().optional(),
  CF_ANALYTICS_API_TOKEN: z.string().optional(),
  // Only e2e sets this, at a local stub, so the bearer token never leaves for another address.
  CF_GRAPHQL_URL: z
    .url({ protocol: /^https?$/, error: "CF_GRAPHQL_URL must be an http(s) URL." })
    .refine(
      (url) => URL.canParse(url) && ["127.0.0.1", "localhost"].includes(new URL(url).hostname),
      "CF_GRAPHQL_URL may only point at 127.0.0.1 or localhost (the e2e stub).",
    )
    .optional(),
});

export const CF_GRAPHQL_DEFAULT_URL = "https://api.cloudflare.com/client/v4/graphql";

export type CloudflareAnalyticsEnv = {
  readonly accountId: string;
  readonly siteTag: string;
  readonly token: string;
  readonly graphqlUrl: string;
};

export type ServerEnv = {
  readonly designSystemPage: boolean;
  readonly cf: CloudflareAnalyticsEnv | null;
};

const CF_KEYS = ["CF_ACCOUNT_ID", "CF_WEB_ANALYTICS_SITE_TAG", "CF_ANALYTICS_API_TOKEN"] as const;

export function parseServerEnv(env: Readonly<Record<string, string | undefined>>): ServerEnv {
  // An empty value counts as unset.
  const parsed = serverEnvSchema.parse({
    DESIGN_SYSTEM_PAGE: env.DESIGN_SYSTEM_PAGE || undefined,
    CF_ACCOUNT_ID: env.CF_ACCOUNT_ID || undefined,
    CF_WEB_ANALYTICS_SITE_TAG: env.CF_WEB_ANALYTICS_SITE_TAG || undefined,
    CF_ANALYTICS_API_TOKEN: env.CF_ANALYTICS_API_TOKEN || undefined,
    CF_GRAPHQL_URL: env.CF_GRAPHQL_URL || undefined,
  });
  const missing = CF_KEYS.filter((key) => parsed[key] === undefined);
  if (missing.length > 0 && missing.length < CF_KEYS.length) {
    throw new Error(
      `Web Analytics needs all three of ${CF_KEYS.join(", ")}; missing: ${missing.join(", ")}.`,
    );
  }
  const { CF_ACCOUNT_ID, CF_WEB_ANALYTICS_SITE_TAG, CF_ANALYTICS_API_TOKEN } = parsed;
  return {
    designSystemPage: parsed.DESIGN_SYSTEM_PAGE === "1",
    cf:
      CF_ACCOUNT_ID && CF_WEB_ANALYTICS_SITE_TAG && CF_ANALYTICS_API_TOKEN
        ? {
            accountId: CF_ACCOUNT_ID,
            siteTag: CF_WEB_ANALYTICS_SITE_TAG,
            token: CF_ANALYTICS_API_TOKEN,
            graphqlUrl: parsed.CF_GRAPHQL_URL ?? CF_GRAPHQL_DEFAULT_URL,
          }
        : null,
  };
}

export function serverEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
