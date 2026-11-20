import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SAMPLE_DRAWINGS,
  SAMPLE_TONES,
  isLocalSupabaseUrl,
  pickSample,
  sampleSvg,
  samplesRefusal,
} from "./media-samples";

// covers: AC-14, AC-15 (spec 0032): the host guards of `pnpm media:samples` and its stable pick.
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const LOCAL_SUPABASE = "http://127.0.0.1:54321";

describe("samplesRefusal", () => {
  it.each([
    [LOCAL_DB, LOCAL_SUPABASE],
    ["postgres://postgres:postgres@localhost:54322/postgres", "http://localhost:54321"],
  ])("lets %s with %s run", (db, supabase) => {
    expect(samplesRefusal(db, supabase)).toBeNull();
  });

  it.each([
    ["postgresql://postgres:secret@db.abcd.supabase.co:5432/postgres"],
    ["postgresql://postgres:postgres@127.0.0.1:5432/postgres"],
    ["not a url"],
    [undefined],
  ])("stops on the database %s", (db) => {
    expect(samplesRefusal(db, LOCAL_SUPABASE)).toMatch(/DATABASE_URL_DIRECT/);
  });

  it.each([
    ["https://abcd.supabase.co"],
    ["http://127.0.0.1.example.com:54321"],
    ["not a url"],
    [undefined],
  ])("stops on the Supabase URL %s", (supabase) => {
    expect(samplesRefusal(LOCAL_DB, supabase)).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("accepts only localhost and 127.0.0.1 as the Supabase host", () => {
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://10.0.0.5:54321")).toBe(false);
  });
});

describe("pickSample", () => {
  it("gives the same id the same drawing and tone", () => {
    const id = randomUUID();
    expect(pickSample(id)).toEqual(pickSample(id));
  });

  it("uses all five drawings and all four tones over 200 ids", () => {
    const picks = Array.from({ length: 200 }, () => pickSample(randomUUID()));
    expect(new Set(picks.map((pick) => pick.drawing)).size).toBe(SAMPLE_DRAWINGS.length);
    expect(new Set(picks.map((pick) => pick.tone)).size).toBe(SAMPLE_TONES);
  });
});

describe("sampleSvg", () => {
  it("sizes a product picture 4:5 and a category picture 1:1, in the colours it is given", () => {
    const product = sampleSvg({
      drawing: "pendant",
      target: "product",
      background: "var(--bg)",
      glow: "var(--glow)",
    });
    expect(product).toContain('width="1200" height="1500" viewBox="0 0 200 250"');
    expect(product).toContain('fill="var(--bg)"');
    expect(product).toContain('stop-color="var(--glow)"');

    const category = sampleSvg({ drawing: "bulb", target: "category", background: "a", glow: "b" });
    expect(category).toContain('width="800" height="800" viewBox="0 0 200 200"');
  });
});
