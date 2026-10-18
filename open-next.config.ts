import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache at launch: pages render on each request (spec 0001).
// Add the R2 incremental cache here only if a speed problem is measured.
export default defineCloudflareConfig({});
