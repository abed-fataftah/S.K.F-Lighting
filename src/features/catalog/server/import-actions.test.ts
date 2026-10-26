import { beforeEach, describe, expect, it, vi } from "vitest";
import { IMPORT_LIMITS } from "../import-schemas";
import { MEDIA_LIMITS, mediaKey } from "../media-rules";

// covers: AC-9, AC-13, AC-15, AC-16 (spec 0007). The database halves are replaced by spies (the
// real ones are proven in import-products.db.test.ts), so these tests prove what each action
// refuses before it would touch the database or Storage.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const after = vi.fn();
vi.mock("next/server", () => ({ after }));

const requireAdmin = vi.fn();
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));

const DB = { name: "db" };
const getDb = vi.fn(async () => DB);
vi.mock("@/server/db", () => ({ getDb }));

const listProductFolder = vi.fn();
const removeKeys = vi.fn();
vi.mock("@/server/storage/admin", () => ({ listProductFolder, removeKeys }));

const readEditorLookups = vi.fn();
const readProductsByCodes = vi.fn();
vi.mock("./admin-queries", () => ({ readEditorLookups, readProductsByCodes }));

const importProductInDb = vi.fn();
vi.mock("./import-products", () => ({ importProductInDb }));

const setProductPhotosInDb = vi.fn();
vi.mock("./product-photos", () => ({ setProductPhotosInDb }));

const { getImportLookups, importProducts, readImportContext, setProductPhotos } =
  await import("./import-actions");

const ID = "1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b";
const OTHER = "2c5f39cb-3fb2-4e4c-b4a6-f02ab6b8744c";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const photoKey = (n: number, product = ID) => mediaKey(product, uuid(n), "webp");
const image = (n: number, product = ID) => ({
  storageKey: photoKey(n, product),
  width: 800,
  height: 600,
});
const stored = (
  n: number,
  fields: { mimetype?: string; size?: number; createdAt?: Date } = {},
) => ({
  name: `${uuid(n)}.webp`,
  createdAt: fields.createdAt ?? new Date(),
  mimetype: fields.mimetype ?? "image/webp",
  size: fields.size ?? 50_000,
});

const LOOKUPS = { categories: [], colours: [{ id: "c1", name: "ذهبي" }] };
const forbidden = { ok: false, error: "forbidden" };
const invalid = { ok: false, error: "invalid" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  requireAdmin.mockResolvedValue({ ok: true, data: { userId: "admin" } });
  readEditorLookups.mockResolvedValue(LOOKUPS);
  readProductsByCodes.mockResolvedValue([]);
});

describe("every import action is admin only (AC-16)", () => {
  it("refuses a customer or an aal1 session and reads or writes nothing", async () => {
    requireAdmin.mockResolvedValue({ ok: false, error: "forbidden" });

    expect(await getImportLookups()).toEqual(forbidden);
    expect(await readImportContext({ codes: ["CH-1"] })).toEqual(forbidden);
    expect(await importProducts({ products: [{ code: "CH-1" }] })).toEqual(forbidden);
    expect(await setProductPhotos({ productId: ID, images: [image(1)] })).toEqual(forbidden);

    expect(requireAdmin).toHaveBeenCalledTimes(4);
    expect(getDb).not.toHaveBeenCalled();
    expect(listProductFolder).not.toHaveBeenCalled();
    expect(importProductInDb).not.toHaveBeenCalled();
    expect(setProductPhotosInDb).not.toHaveBeenCalled();
  });
});

describe("getImportLookups", () => {
  it("gives the categories and colours for the template's lists sheet", async () => {
    expect(await getImportLookups()).toEqual({ ok: true, data: LOOKUPS });
    expect(readEditorLookups).toHaveBeenCalledWith(DB);
  });
});

describe("readImportContext (AC-9, AC-14, AC-16)", () => {
  it("answers which codes are products already, with the lookups", async () => {
    const found = [{ code: "CH-1", id: ID, status: "active" }];
    readProductsByCodes.mockResolvedValue(found);

    expect(await readImportContext({ codes: ["CH-1", "LMP-2"] })).toEqual({
      ok: true,
      data: { products: found, lookups: LOOKUPS },
    });
    expect(readProductsByCodes).toHaveBeenCalledWith(DB, ["CH-1", "LMP-2"]);
  });

  it("takes 1,500 distinct codes", async () => {
    const codes = Array.from({ length: IMPORT_LIMITS.maxContextCodes }, (_, i) => `C-${i}`);
    expect((await readImportContext({ codes })).ok).toBe(true);
  });

  it.each([
    ["1,501 codes", { codes: Array.from({ length: 1501 }, (_, i) => `C-${i}`) }],
    ["a repeated code", { codes: ["CH-1", "CH-1"] }],
    ["a code the page did not normalise", { codes: ["ch-1"] }],
    ["no codes field", {}],
    ["not an object", "CH-1"],
  ])("refuses %s as invalid without reading", async (_, input) => {
    expect(await readImportContext(input)).toEqual(invalid);
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe("importProducts (AC-15, AC-16)", () => {
  it("saves each product in turn and answers each one's outcome in order", async () => {
    importProductInDb
      .mockResolvedValueOnce({ code: "CH-1", outcome: "created", id: ID })
      .mockResolvedValueOnce({ code: "CH-2", outcome: "skipped", problem: "archived" })
      .mockResolvedValueOnce({ code: "CH-3", outcome: "updated", id: OTHER });

    const result = await importProducts({
      products: [{ code: "CH-1" }, { code: "CH-2" }, { code: "CH-3" }],
    });

    expect(result).toEqual({
      ok: true,
      data: {
        results: [
          { code: "CH-1", outcome: "created", id: ID },
          { code: "CH-2", outcome: "skipped", problem: "archived" },
          { code: "CH-3", outcome: "updated", id: OTHER },
        ],
      },
    });
    expect(importProductInDb).toHaveBeenNthCalledWith(1, DB, { code: "CH-1" });
  });

  it("hands every product to the server's own check, never trusting the page", async () => {
    importProductInDb.mockResolvedValue({ code: "", outcome: "skipped", problem: "invalid" });
    await importProducts({ products: [{ code: "<script>" }] });
    expect(importProductInDb).toHaveBeenCalledWith(DB, { code: "<script>" });
  });

  it("takes 25 products and refuses 26 or none as invalid", async () => {
    importProductInDb.mockResolvedValue({ code: "X", outcome: "created", id: ID });
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ code: `C-${i}` }));

    expect((await importProducts({ products: many(IMPORT_LIMITS.batchSize) })).ok).toBe(true);
    importProductInDb.mockClear();
    expect(await importProducts({ products: many(26) })).toEqual(invalid);
    expect(await importProducts({ products: [] })).toEqual(invalid);
    expect(await importProducts(null)).toEqual(invalid);
    expect(importProductInDb).not.toHaveBeenCalled();
  });

  it("turns one product's crash into save_failed and goes on with the rest", async () => {
    importProductInDb
      .mockRejectedValueOnce(new Error("connection reset: 0599123456"))
      .mockResolvedValueOnce({ code: "CH-2", outcome: "created", id: ID });

    const result = await importProducts({ products: [{ code: "CH-1" }, { code: "CH-2" }] });

    expect(result).toEqual({
      ok: true,
      data: {
        results: [
          { code: "CH-1", outcome: "skipped", problem: "save_failed" },
          { code: "CH-2", outcome: "created", id: ID },
        ],
      },
    });
  });

  it("names no code for a crashed product whose code is not text", async () => {
    importProductInDb.mockRejectedValueOnce(new Error("boom"));
    const result = await importProducts({ products: [{ code: 7 }] });
    expect(result.ok && result.data.results[0]).toEqual({
      code: "",
      outcome: "skipped",
      problem: "save_failed",
    });
  });

  it("logs the error name and counts, never the error message or cell text", async () => {
    importProductInDb
      .mockRejectedValueOnce(new Error("secret cell text 0599123456"))
      .mockResolvedValueOnce({ code: "CH-2", outcome: "created", id: ID });
    await importProducts({ products: [{ code: "CH-1", name: "ثريا" }, { code: "CH-2" }] });

    const logged = [
      ...vi.mocked(console.error).mock.calls,
      ...vi.mocked(console.info).mock.calls,
    ].join("\n");
    expect(logged).not.toContain("0599123456");
    expect(logged).not.toContain("ثريا");
    expect(logged).toContain('"created":1');
    expect(logged).toContain('"skipped":1');
  });
});

describe("setProductPhotos (AC-13, AC-16)", () => {
  beforeEach(() => {
    listProductFolder.mockResolvedValue([stored(1), stored(2)]);
    setProductPhotosInDb.mockResolvedValue({
      kind: "saved",
      version: 5,
      keptKeys: [photoKey(1), photoKey(2)],
    });
  });

  it("attaches photos that are in the product's folder and answers the new version", async () => {
    const result = await setProductPhotos({
      productId: ID.toUpperCase(),
      images: [image(1), image(2)],
    });

    expect(result).toEqual({ ok: true, data: { version: 5 } });
    expect(listProductFolder).toHaveBeenCalledWith(ID);
    expect(setProductPhotosInDb).toHaveBeenCalledWith(DB, ID, [image(1), image(2)]);
    expect(after).toHaveBeenCalledOnce();
  });

  it("refuses a key from another product's folder before listing Storage", async () => {
    const result = await setProductPhotos({ productId: ID, images: [image(1), image(2, OTHER)] });
    expect(result).toEqual({ ok: false, error: "media_invalid" });
    expect(listProductFolder).not.toHaveBeenCalled();
  });

  it.each([
    ["a video key", { storageKey: mediaKey(ID, uuid(1), "mp4"), width: 800, height: 600 }],
    ["a hand written key", { storageKey: `products/${ID}/../x.webp`, width: 800, height: 600 }],
  ])("refuses %s as media_invalid", async (_, bad) => {
    expect(await setProductPhotos({ productId: ID, images: [bad] })).toEqual({
      ok: false,
      error: "media_invalid",
    });
  });

  it("refuses the same key twice", async () => {
    expect(await setProductPhotos({ productId: ID, images: [image(1), image(1)] })).toEqual({
      ok: false,
      error: "media_invalid",
    });
  });

  it.each([
    ["missing from Storage", [stored(2)]],
    ["stored with another type", [stored(1, { mimetype: "text/html" })]],
    ["empty", [stored(1, { size: 0 })]],
    ["over the photo size limit", [stored(1, { size: MEDIA_LIMITS.imageMaxBytes + 1 })]],
  ])("refuses a photo %s and writes nothing", async (_, folder) => {
    listProductFolder.mockResolvedValue(folder);
    expect(await setProductPhotos({ productId: ID, images: [image(1)] })).toEqual({
      ok: false,
      error: "media_invalid",
    });
    expect(setProductPhotosInDb).not.toHaveBeenCalled();
  });

  it("takes 8 photos and refuses a 9th or none as invalid", async () => {
    const eight = Array.from({ length: 8 }, (_, i) => i + 1);
    listProductFolder.mockResolvedValue(eight.map((n) => stored(n)));
    expect((await setProductPhotos({ productId: ID, images: eight.map((n) => image(n)) })).ok).toBe(
      true,
    );

    const nine = [...eight, 9].map((n) => image(n));
    expect(await setProductPhotos({ productId: ID, images: nine })).toEqual(invalid);
    expect(await setProductPhotos({ productId: ID, images: [] })).toEqual(invalid);
  });

  it.each([
    ["a product id that is not a uuid", { productId: "CH-1", images: [image(1)] }],
    [
      "a photo wider than the longest edge",
      { productId: ID, images: [{ ...image(1), width: 2001 }] },
    ],
    ["a photo with no height", { productId: ID, images: [{ ...image(1), height: 0 }] }],
  ])("refuses %s as invalid", async (_, input) => {
    expect(await setProductPhotos(input)).toEqual(invalid);
  });

  it.each(["not_found", "archived"] as const)("answers %s from the database", async (kind) => {
    setProductPhotosInDb.mockResolvedValue({ kind });
    expect(await setProductPhotos({ productId: ID, images: [image(1)] })).toEqual({
      ok: false,
      error: kind,
    });
    expect(after).not.toHaveBeenCalled();
  });

  it("answers save_failed when Storage cannot be listed", async () => {
    listProductFolder.mockRejectedValue(new Error("storage down"));
    expect(await setProductPhotos({ productId: ID, images: [image(1)] })).toEqual({
      ok: false,
      error: "save_failed",
    });
    expect(setProductPhotosInDb).not.toHaveBeenCalled();
  });

  it("answers save_failed when the database write throws", async () => {
    setProductPhotosInDb.mockRejectedValue(new Error("deadlock"));
    expect(await setProductPhotos({ productId: ID, images: [image(1)] })).toEqual({
      ok: false,
      error: "save_failed",
    });
  });

  it("after the save, removes only the replaced files old enough to be leftovers", async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    listProductFolder.mockResolvedValue([
      stored(1),
      stored(7, { createdAt: old }),
      stored(8, { createdAt: new Date() }),
    ]);
    setProductPhotosInDb.mockResolvedValue({ kind: "saved", version: 2, keptKeys: [photoKey(1)] });

    await setProductPhotos({ productId: ID, images: [image(1)] });
    const cleanup = after.mock.calls[0][0] as () => Promise<void>;
    await cleanup();

    expect(removeKeys).toHaveBeenCalledWith([photoKey(7)]);
  });

  it("keeps the save when the cleanup fails", async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    listProductFolder.mockResolvedValue([stored(1), stored(7, { createdAt: old })]);
    removeKeys.mockRejectedValue(new Error("storage down"));

    const result = await setProductPhotos({ productId: ID, images: [image(1)] });
    const cleanup = after.mock.calls[0][0] as () => Promise<void>;

    await expect(cleanup()).resolves.toBeUndefined();
    expect(result).toEqual({ ok: true, data: { version: 5 } });
  });
});
