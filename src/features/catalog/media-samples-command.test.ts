import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// covers: AC-14 (spec 0032): the real `pnpm media:samples` runner refuses a non local host before
// it opens a database client or touches storage, prints why, and exits 1. Set values win over
// .env.local, so each case overrides one URL and keeps the other local.
const root = process.cwd();
const tsx = join(root, "node_modules", "tsx", "dist", "cli.mjs");
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_SUPABASE = "http://127.0.0.1:54321";

function runSamples(env: Readonly<Record<string, string>>) {
  return spawnSync(
    process.execPath,
    [tsx, "--conditions=react-server", join("scripts", "media-samples.ts")],
    { cwd: root, encoding: "utf8", env: { ...process.env, ...env }, timeout: 60_000 },
  );
}

describe("pnpm media:samples", () => {
  it("refuses a remote Supabase URL with exit 1 and adds nothing", () => {
    const run = runSamples({
      DATABASE_URL_DIRECT: LOCAL_DB,
      NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("Refusing to add sample pictures");
    expect(run.stderr).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(run.stdout).not.toContain("Added sample pictures");
  }, 60_000);

  it("refuses a database that is not the local one with exit 1 and adds nothing", () => {
    const run = runSamples({
      DATABASE_URL_DIRECT: "postgresql://postgres:secret@db.abcd.supabase.co:5432/postgres",
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_SUPABASE,
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("DATABASE_URL_DIRECT");
    expect(run.stdout).not.toContain("Added sample pictures");
  }, 60_000);
});
