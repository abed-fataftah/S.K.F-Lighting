import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    // Vite's resolver fails to take the real path of OneDrive placeholder files, so every
    // package import resolved to nothing and fell back to Node. node_modules is hoisted
    // (.npmrc), with no symlinks to follow, so skipping that step changes nothing else.
    preserveSymlinks: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Database tests (*.db.test.ts) share the local database, so files run one at a time.
    fileParallelism: false,
    // next-intl imports `next/server` without an extension; Node cannot resolve that
    // (Next has no exports map), so let Vite bundle next-intl instead.
    server: { deps: { inline: ["next-intl"] } },
  },
});
