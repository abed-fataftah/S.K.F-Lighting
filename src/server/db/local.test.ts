import { describe, expect, it } from "vitest";
import { isLocalDatabaseUrl } from "./local";

// covers: AC-12 (spec 0002, the seed's local only guard)
describe("isLocalDatabaseUrl", () => {
  it.each([
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "postgres://postgres:postgres@localhost:54322/postgres",
  ])("accepts the local Supabase database %s", (url) => {
    expect(isLocalDatabaseUrl(url)).toBe(true);
  });

  it.each([
    [
      "the Supabase pooler",
      "postgresql://postgres.abc:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
    ],
    ["localhost on another port", "postgresql://postgres:postgres@127.0.0.1:5432/postgres"],
    [
      "a host that only starts with localhost",
      "postgresql://postgres@localhost.evil.example:54322/postgres",
    ],
    ["another protocol", "http://127.0.0.1:54322/postgres"],
    ["not a URL", "127.0.0.1:54322"],
    ["empty", ""],
    ["unset", undefined],
  ])("refuses %s", (_label, url) => {
    expect(isLocalDatabaseUrl(url)).toBe(false);
  });
});
