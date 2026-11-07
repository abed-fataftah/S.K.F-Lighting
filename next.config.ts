import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import createNextIntlPlugin from "next-intl/plugin";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { parsePublicEnv } from "./src/lib/public-env";

// Spec 0003: the build fails when the WhatsApp number is missing or malformed.
parsePublicEnv();

// Spec 0001: every page renders on each request at launch, so Cache Components
// stays off. Images resize on Supabase, never on the Worker.
const nextConfig: NextConfig = {
  // A customer's order page and its lookup are never kept by a shared cache, so OpenNext never
  // serves one visitor's page or redirect to another (spec 0015 AC-7).
  async headers() {
    return [
      { source: "/orders/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
  images: {
    loader: "custom",
    loaderFile: "./src/image-loader.ts",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config = withNextIntl(nextConfig);

// Spec 0027 AC-8: only the deploy job has SENTRY_AUTH_TOKEN. There the Sentry plugin uploads the
// source maps during the Next build, under the release SENTRY_RELEASE (the git commit), and deletes
// them afterwards, before OpenNext bundles the Worker, so they are never served. Check builds and
// local builds stay plain.
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(config, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: process.env.SENTRY_RELEASE },
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      widenClientFileUpload: true,
      telemetry: false,
      silent: !process.env.CI,
    })
  : config;

// Gives `next dev` access to Worker bindings (HYPERDRIVE) through getCloudflareContext().
initOpenNextCloudflareForDev();
