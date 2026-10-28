import type { NextConfig } from "next";
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

export default withNextIntl(nextConfig);

// Gives `next dev` access to Worker bindings (HYPERDRIVE) through getCloudflareContext().
initOpenNextCloudflareForDev();
