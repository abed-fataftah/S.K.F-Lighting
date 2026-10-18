import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // next-intl imports `next/server` without an extension; Node cannot resolve that
    // (Next has no exports map), so let Vite bundle next-intl instead.
    server: { deps: { inline: ["next-intl"] } },
  },
});
