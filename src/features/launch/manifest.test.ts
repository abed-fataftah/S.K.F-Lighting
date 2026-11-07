import { describe, expect, it } from "vitest";
import { buildManifest, compareCounts, parseManifest, totalRows } from "./manifest";

const meta = {
  takenAt: new Date("2026-11-08T01:00:42.000Z"),
  gitSha: "2d871c3",
  pgDump: "pg_dump (PostgreSQL) 17.6",
};

const manifest = buildManifest(
  {
    "public.orders": 412,
    "auth.users": 87,
    "public.profiles": 87,
    "drizzle.__drizzle_migrations": 31,
  },
  { objects: 340, bytes: 81_234_567 },
  meta,
);

// covers: AC-5 (spec 0028): counts, versions, and the media total, and nothing else.
describe("buildManifest", () => {
  it("keeps only the fixed fields, tables in name order", () => {
    expect(manifest).toEqual({
      takenAt: "2026-11-08T01:00:42.000Z",
      gitSha: "2d871c3",
      pgDump: "pg_dump (PostgreSQL) 17.6",
      tables: {
        "auth.users": 87,
        "drizzle.__drizzle_migrations": 31,
        "public.orders": 412,
        "public.profiles": 87,
      },
      media: { objects: 340, bytes: 81_234_567 },
    });
    expect(Object.keys(manifest.tables)).toEqual([
      "auth.users",
      "drizzle.__drizzle_migrations",
      "public.orders",
      "public.profiles",
    ]);
    expect(totalRows(manifest)).toBe(617);
  });

  it("writes media null when the photo copy failed", () => {
    expect(buildManifest({ "public.orders": 1 }, null, meta).media).toBeNull();
  });

  it("refuses an empty table list or a count that is not a whole number", () => {
    expect(() => buildManifest({}, null, meta)).toThrow();
    expect(() => buildManifest({ "public.orders": 1.5 }, null, meta)).toThrow();
    expect(() => buildManifest({ "public.orders": -1 }, null, meta)).toThrow();
  });
});

// covers: AC-10 (spec 0028): a manifest read back from R2 is checked before the drill trusts it.
describe("parseManifest", () => {
  it("reads back what buildManifest wrote", () => {
    expect(parseManifest(JSON.parse(JSON.stringify(manifest)))).toEqual(manifest);
  });

  it.each([
    ["no tables", { ...manifest, tables: {} }],
    ["a table name with no schema", { ...manifest, tables: { orders: 1 } }],
    ["a time that is not ISO", { ...manifest, takenAt: "Sunday" }],
    ["media with no bytes", { ...manifest, media: { objects: 3 } }],
    ["no media key at all", { ...manifest, media: undefined }],
  ])("refuses %s", (_name, json) => {
    expect(() => parseManifest(json)).toThrow();
  });
});

// covers: AC-10 (spec 0028): every listed table must come back with exactly its count.
describe("compareCounts", () => {
  const restored = {
    "auth.users": 87,
    "drizzle.__drizzle_migrations": 31,
    "public.orders": 412,
    "public.profiles": 87,
  };

  it("finds nothing when every count matches", () => {
    expect(compareCounts(manifest, restored)).toEqual([]);
  });

  it("names a table whose count changed", () => {
    expect(compareCounts(manifest, { ...restored, "public.orders": 411 })).toEqual([
      { table: "public.orders", expected: 412, actual: 411 },
    ]);
  });

  it("catches profiles made twice by the sign up trigger", () => {
    expect(compareCounts(manifest, { ...restored, "public.profiles": 174 })).toEqual([
      { table: "public.profiles", expected: 87, actual: 174 },
    ]);
  });

  it("names a table missing from the restored database", () => {
    const rest = Object.fromEntries(
      Object.entries(restored).filter(([table]) => table !== "auth.users"),
    );
    expect(compareCounts(manifest, rest)).toEqual([
      { table: "auth.users", expected: 87, actual: null },
    ]);
    expect(compareCounts(manifest, { ...rest, "auth.users": null })).toEqual([
      { table: "auth.users", expected: 87, actual: null },
    ]);
  });
});
