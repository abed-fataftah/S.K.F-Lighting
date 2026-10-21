import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEDIA_LIMITS, mediaKey, parseMediaKey } from "../media-rules";

// covers: AC-8, AC-16 (spec 0006). The database and Storage are replaced by spies, so these tests
// prove what each action does before it would touch either.

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));

const requireAdmin = vi.fn();
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));

const getDb = vi.fn(async () => {
  throw new Error("the database must not be reached");
});
vi.mock("@/server/db", () => ({ getDb }));

const createSignedUpload = vi.fn(async () => ({ signedUrl: "https://storage/sign", token: "t" }));
const listProductFolder = vi.fn();
const removeKeys = vi.fn();
const removeProductFolder = vi.fn();
vi.mock("@/server/storage/admin", () => ({
  createSignedUpload,
  listProductFolder,
  removeKeys,
  removeProductFolder,
}));

const { createMediaUpload, deleteProduct, restoreProduct, saveProduct } = await import("./actions");

const ID = "1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b";
const FILE = "9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";

const payload = (media: readonly unknown[] = []) => ({
  id: ID,
  version: null,
  name: "ثريا",
  code: "CH-1",
  categoryId: "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607",
  subCategoryId: "",
  newCategoryName: "",
  description: "",
  specs: [],
  visible: true,
  available: true,
  price: "10",
  sizes: [],
  colours: [],
  pairs: [],
  media,
});

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ ok: true, data: { userId: "admin" } });
});

describe("every product action is admin only", () => {
  it("refuses a customer or an aal1 session and reads or writes nothing", async () => {
    requireAdmin.mockResolvedValue({ ok: false, error: "forbidden" });
    const forbidden = { ok: false, error: "forbidden" };

    expect(await saveProduct(payload())).toEqual(forbidden);
    expect(
      await createMediaUpload({ productId: ID, kind: "image", contentType: "image/webp", size: 1 }),
    ).toEqual(forbidden);
    expect(await deleteProduct({ id: ID, version: 1 })).toEqual(forbidden);
    expect(await restoreProduct({ id: ID, version: 1 })).toEqual(forbidden);

    expect(getDb).not.toHaveBeenCalled();
    expect(createSignedUpload).not.toHaveBeenCalled();
    expect(listProductFolder).not.toHaveBeenCalled();
  });
});

describe("createMediaUpload", () => {
  it("signs one server chosen key in the product's folder for an allowed type", async () => {
    const result = await createMediaUpload({
      productId: ID.toUpperCase(),
      kind: "image",
      contentType: "image/jpeg",
      size: 1000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(parseMediaKey(result.data.storageKey)).toMatchObject({ productId: ID, ext: "jpg" });
    expect(createSignedUpload).toHaveBeenCalledWith(result.data.storageKey);
  });

  it.each([
    [{ kind: "image", contentType: "image/png", size: 1 }, "invalid_type"],
    [{ kind: "image", contentType: "video/mp4", size: 1 }, "invalid_type"],
    [{ kind: "video", contentType: "video/quicktime", size: 1 }, "invalid_type"],
    [
      { kind: "image", contentType: "image/webp", size: MEDIA_LIMITS.imageMaxBytes + 1 },
      "too_large",
    ],
    [
      { kind: "video", contentType: "video/mp4", size: MEDIA_LIMITS.videoMaxBytes + 1 },
      "too_large",
    ],
  ])("refuses %j as %s", async (fields, error) => {
    expect(await createMediaUpload({ productId: ID, ...fields })).toEqual({ ok: false, error });
    expect(createSignedUpload).not.toHaveBeenCalled();
  });
});

describe("saveProduct media checks", () => {
  const key = mediaKey(ID, FILE, "webp");
  const photo = { storageKey: key, kind: "image", width: 100, height: 100 };

  it("refuses a file whose real type or size in Storage breaks the limits, writing nothing", async () => {
    listProductFolder.mockResolvedValue([
      { name: `${FILE}.webp`, createdAt: new Date(), mimetype: "image/png", size: 10 },
    ]);
    expect(await saveProduct(payload([photo]))).toEqual({ ok: false, error: "media_invalid" });
    listProductFolder.mockResolvedValue([]);
    expect(await saveProduct(payload([photo]))).toEqual({ ok: false, error: "media_invalid" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("refuses a key from another product's folder as invalid before Storage is asked", async () => {
    const forged = { ...photo, storageKey: mediaKey(FILE, FILE, "webp") };
    const result = await saveProduct(payload([forged]));
    expect(result).toMatchObject({ ok: false, error: "invalid" });
    expect(listProductFolder).not.toHaveBeenCalled();
  });
});
