import { describe, expect, it } from "vitest";
import type { Review } from "./import-plan";
import { batches, runImport, runProblems, runTotals, type RunEffects } from "./import-run";
import type { ImportProductInput } from "./import-schemas";

// covers: AC-13, AC-15 (spec 0007)

const product = (code: string, rows: number[] = [2]): ImportProductInput => ({
  code,
  rows,
  specs: [],
  sizes: [],
  colours: [],
  price: "5",
});

const review = (fields: Partial<Review>): Review => ({
  okRows: 0,
  problemRows: 0,
  unmatchedPhotos: 0,
  created: 0,
  updated: 0,
  newCategories: [],
  newColours: [],
  items: [],
  problems: [],
  send: [],
  photos: [],
  canConfirm: true,
  ...fields,
});

type Photo = { readonly width: number; readonly height: number; readonly fileId: string };

/** Effects that succeed, with a log of what was called; override any of them. */
function fakeEffects(overrides: Partial<RunEffects<Photo>> = {}) {
  const calls = {
    batches: [] as string[][],
    uploads: [] as string[],
    setPhotos: [] as [string, string[]][],
  };
  let inFlight = 0;
  let maxInFlight = 0;
  const effects: RunEffects<Photo> = {
    importBatch: async (products) => {
      calls.batches.push(products.map((p) => p.code));
      return {
        ok: true,
        results: products.map((p) => ({
          code: p.code,
          outcome: "created" as const,
          id: `id-${p.code}`,
        })),
      };
    },
    preparePhoto: async (fileId) => ({ width: 800, height: 600, fileId }),
    uploadPhoto: async (_, photo) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      calls.uploads.push(photo.fileId);
      return `key-${photo.fileId}`;
    },
    setPhotos: async (productId, images) => {
      calls.setPhotos.push([productId, images.map((image) => image.storageKey)]);
      return "ok";
    },
    onProgress: () => {},
    ...overrides,
  };
  return { effects, calls, maxInFlight: () => maxInFlight };
}

describe("batches", () => {
  it("splits into groups of the given size", () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batches([], 25)).toEqual([]);
  });
});

describe("runImport", () => {
  it("sends products 25 at a time, one batch after another", async () => {
    const send = Array.from({ length: 60 }, (_, i) => product(`P-${i}`));
    const { effects, calls } = fakeEffects();
    const progress: number[] = [];
    const result = await runImport(review({ send }), {
      ...effects,
      onProgress: (p) => progress.push(p.done),
    });
    expect(calls.batches.map((batch) => batch.length)).toEqual([25, 25, 10]);
    expect(progress).toEqual([0, 25, 50, 60]);
    expect(runTotals(60, result)).toEqual({ created: 60, updated: 0, photos: 0, notImported: 0 });
  });

  it("attaches photos in position order to sheet products it wrote and to live products", async () => {
    const files = (code: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `${code}-${i}`, name: `${code}_${i + 1}.jpg` }));
    const { effects, calls, maxInFlight } = fakeEffects();
    const result = await runImport(
      review({
        send: [product("NEW-1")],
        photos: [
          { code: "NEW-1", productId: null, fromSheet: true, files: files("NEW-1", 6) },
          { code: "LIVE-1", productId: "id-live", fromSheet: false, files: files("LIVE-1", 2) },
        ],
      }),
      effects,
    );
    expect(calls.setPhotos).toEqual([
      ["id-NEW-1", Array.from({ length: 6 }, (_, i) => `key-NEW-1-${i}`)],
      ["id-live", ["key-LIVE-1-0", "key-LIVE-1-1"]],
    ]);
    expect(maxInFlight()).toBeLessThanOrEqual(4);
    expect(runTotals(1, result)).toEqual({ created: 1, updated: 1, photos: 8, notImported: 0 });
  });

  it("turns the photos of a product the run skipped into problems, and lists its rows", async () => {
    const { effects, calls } = fakeEffects({
      importBatch: async () => ({
        ok: true,
        results: [{ code: "NEW-1", outcome: "skipped", problem: "code_taken" }],
      }),
    });
    const run = review({
      send: [product("NEW-1", [2, 3])],
      photos: [
        {
          code: "NEW-1",
          productId: null,
          fromSheet: true,
          files: [{ id: "a", name: "NEW-1.jpg" }],
        },
      ],
    });
    const result = await runImport(run, effects);
    expect(calls.setPhotos).toEqual([]);
    expect(runProblems(run, result).map((p) => [p.row ?? p.file, p.problem])).toEqual([
      [2, "code_taken"],
      [3, "code_taken"],
      ["NEW-1.jpg", "photo_product_skipped"],
    ]);
    expect(runTotals(1, result).notImported).toBe(1);
  });

  it("retries a failed upload once, leaves out what still fails or cannot be read", async () => {
    const tries = new Map<string, number>();
    const { effects, calls } = fakeEffects({
      preparePhoto: async (fileId) => (fileId === "bad" ? null : { width: 1, height: 1, fileId }),
      uploadPhoto: async (_, photo) => {
        const n = (tries.get(photo.fileId) ?? 0) + 1;
        tries.set(photo.fileId, n);
        if (photo.fileId === "flaky" && n === 1) return null;
        return photo.fileId === "down" ? null : `key-${photo.fileId}`;
      },
    });
    const result = await runImport(
      review({
        photos: [
          {
            code: "LIVE-1",
            productId: "id-live",
            fromSheet: false,
            files: [
              { id: "flaky", name: "LIVE-1.jpg" },
              { id: "bad", name: "LIVE-1_2.jpg" },
              { id: "down", name: "LIVE-1_3.jpg" },
            ],
          },
        ],
      }),
      effects,
    );
    expect(tries.get("flaky")).toBe(2);
    expect(tries.get("down")).toBe(2);
    expect(calls.setPhotos).toEqual([["id-live", ["key-flaky"]]]);
    expect(result.photoProblems.map((p) => [p.file, p.problem])).toEqual([
      ["LIVE-1_2.jpg", "photo_unreadable"],
      ["LIVE-1_3.jpg", "photo_upload_failed"],
    ]);
    expect(result.attached).toBe(1);
  });

  it("makes no call when none of a product's photos upload", async () => {
    const { effects, calls } = fakeEffects({ uploadPhoto: async () => null });
    const result = await runImport(
      review({
        photos: [
          {
            code: "LIVE-1",
            productId: "id-live",
            fromSheet: false,
            files: [{ id: "a", name: "LIVE-1.jpg" }],
          },
        ],
      }),
      effects,
    );
    expect(calls.setPhotos).toEqual([]);
    expect(runTotals(0, result)).toEqual({ created: 0, updated: 0, photos: 0, notImported: 0 });
  });

  it("stops sending once the session has ended", async () => {
    const { effects, calls } = fakeEffects({
      importBatch: async (products) => {
        calls.batches.push(products.map((p) => p.code));
        return { ok: false, error: "forbidden" };
      },
    });
    const send = Array.from({ length: 30 }, (_, i) => product(`P-${i}`));
    const result = await runImport(review({ send }), effects);
    expect(calls.batches).toHaveLength(1);
    expect(result.forbidden).toBe(true);
    expect(result.outcomes.every((outcome) => outcome.outcome === "skipped")).toBe(true);
  });
});
