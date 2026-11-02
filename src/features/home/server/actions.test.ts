import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-9, AC-10, AC-13, AC-15 (spec 0011). The database calls are replaced by spies, so these
// tests prove what each action does around them: the admin check first, input checked before the
// database, the server made upload key, and the picture removed only after a save commits.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const afterCallbacks: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => afterCallbacks.push(fn) }));

const requireAdmin = vi.fn();
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));

// The edit path reads the stored key with `select().from().where()`.
const storedRows = vi.fn(async (): Promise<{ imageKey: string }[]> => []);
const fakeDb = { select: () => ({ from: () => ({ where: storedRows }) }) };
const getDb = vi.fn(async () => fakeDb);
vi.mock("@/server/db", () => ({ getDb }));

const saveBannerInDb = vi.fn();
const deleteBannerInDb = vi.fn();
const saveHomepageInDb = vi.fn();
const searchHomeProductsInDb = vi.fn();
vi.mock("./homepage-db", () => ({
  saveBannerInDb,
  deleteBannerInDb,
  saveHomepageInDb,
  searchHomeProductsInDb,
}));

const storedImageFits = vi.fn();
vi.mock("./media-check", () => ({ storedImageFits }));

const createSignedUpload = vi.fn(async () => ({ token: "t", signedUrl: "https://upload" }));
const removeKeys = vi.fn(async () => {});
vi.mock("@/server/storage/admin", () => ({ createSignedUpload, removeKeys }));

const { createHomeImageUpload, deleteBanner, saveBanner, saveHomepage, searchHomeProducts } =
  await import("./actions");

const ID = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const KEY = "banners/9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e50.webp";
const NEW_KEY = "banners/9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e51.webp";
const ALT = "تخفيضات الشتاء على الثريات";

const bannerInput = (fields: Record<string, unknown> = {}) => ({
  version: 3,
  imageKey: NEW_KEY,
  alt: ALT,
  link: { kind: "none" },
  ...fields,
});

const savedBanner = (fields: Record<string, unknown> = {}) => ({
  kind: "saved",
  created: true,
  version: 4,
  replacedKey: null,
  banner: { id: ID, imageKey: NEW_KEY, alt: ALT, isActive: true, link: null },
  ...fields,
});

const runAfter = async () => {
  for (const fn of afterCallbacks.splice(0)) await fn();
};

let info: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  requireAdmin.mockResolvedValue({ ok: true, data: { userId: "admin" } });
  storedImageFits.mockResolvedValue(true);
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  info.mockRestore();
  error.mockRestore();
});

const logged = () => [...info.mock.calls, ...error.mock.calls].map((call) => String(call[0]));

describe("every homepage action is admin only", () => {
  it("refuses a customer or an aal1 session and reads or writes nothing", async () => {
    requireAdmin.mockResolvedValue({ ok: false, error: "forbidden" });
    const forbidden = { ok: false, error: "forbidden" };

    expect(await searchHomeProducts({ q: "ثريا" })).toEqual(forbidden);
    expect(
      await createHomeImageUpload({ target: "banner", contentType: "image/webp", size: 100 }),
    ).toEqual(forbidden);
    expect(await saveBanner(bannerInput())).toEqual(forbidden);
    expect(await deleteBanner({ version: 3, id: ID })).toEqual(forbidden);
    expect(
      await saveHomepage({ version: 3, banners: [], featured: [], homeCategoryIds: [] }),
    ).toEqual(forbidden);

    expect(getDb).not.toHaveBeenCalled();
    expect(createSignedUpload).not.toHaveBeenCalled();
    expect(storedImageFits).not.toHaveBeenCalled();
  });
});

describe("input is checked before the database", () => {
  it("returns field errors for a short title and refuses a key the server did not make", async () => {
    expect(await saveBanner(bannerInput({ alt: " ثر " }))).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { alt: { code: "too_short" } },
    });
    expect(
      await saveBanner(
        bannerInput({ imageKey: "categories/9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e50.webp" }),
      ),
    ).toMatchObject({ ok: false, error: "invalid", fieldErrors: { imageKey: expect.anything() } });
    expect(await saveBanner(bannerInput({ imageKey: "banners/../secret.webp" }))).toMatchObject({
      error: "invalid",
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("treats a bad banner id on delete as not found and a bad page save as invalid", async () => {
    expect(await deleteBanner({ version: 3, id: "x" })).toEqual({ ok: false, error: "not_found" });
    expect(
      await saveHomepage({ version: 3, banners: [{ id: "x", isActive: true }], featured: [] }),
    ).toEqual({ ok: false, error: "invalid" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("answers an empty search after tidying with no results, without the database", async () => {
    expect(await searchHomeProducts({ q: "   " })).toEqual({ ok: true, data: [] });
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe("createHomeImageUpload", () => {
  it("issues a server made key for a banner and a category photo", async () => {
    const banner = await createHomeImageUpload({
      target: "banner",
      contentType: "image/webp",
      size: 1000,
    });
    const category = await createHomeImageUpload({
      target: "category",
      contentType: "image/jpeg",
      size: 1000,
    });

    expect(banner).toMatchObject({ ok: true, data: { token: "t", signedUrl: "https://upload" } });
    if (!banner.ok || !category.ok) throw new Error("expected ok");
    expect(banner.data.storageKey).toMatch(/^banners\/[0-9a-f-]{36}\.webp$/);
    expect(category.data.storageKey).toMatch(/^categories\/[0-9a-f-]{36}\.jpg$/);
    expect(createSignedUpload).toHaveBeenCalledWith(banner.data.storageKey);
  });

  it("refuses a type that is not a WebP or JPEG picture, and a file over 10 MB", async () => {
    for (const contentType of ["image/png", "video/mp4", "text/html"]) {
      expect(await createHomeImageUpload({ target: "banner", contentType, size: 1000 })).toEqual({
        ok: false,
        error: "invalid_type",
      });
    }
    expect(
      await createHomeImageUpload({
        target: "banner",
        contentType: "image/webp",
        size: 10 * 1024 * 1024 + 1,
      }),
    ).toEqual({ ok: false, error: "too_large" });
    expect(createSignedUpload).not.toHaveBeenCalled();
  });
});

describe("saveBanner", () => {
  it("refuses a new picture Storage does not hold, writing nothing", async () => {
    storedImageFits.mockResolvedValue(false);

    expect(await saveBanner(bannerInput())).toEqual({ ok: false, error: "media_invalid" });
    expect(storedImageFits).toHaveBeenCalledWith(NEW_KEY);
    expect(saveBannerInDb).not.toHaveBeenCalled();
  });

  it("does not check the stored key again on an edit that keeps its picture", async () => {
    storedRows.mockResolvedValueOnce([{ imageKey: KEY }]);
    saveBannerInDb.mockResolvedValue(savedBanner({ created: false }));

    const result = await saveBanner(bannerInput({ id: ID, imageKey: KEY }));

    expect(result).toMatchObject({ ok: true, data: { version: 4 } });
    expect(storedImageFits).not.toHaveBeenCalled();
    await runAfter();
    expect(removeKeys).not.toHaveBeenCalled();
  });

  it("returns not found for an edit of a banner that is gone", async () => {
    storedRows.mockResolvedValueOnce([]);

    expect(await saveBanner(bannerInput({ id: ID }))).toEqual({ ok: false, error: "not_found" });
    expect(saveBannerInDb).not.toHaveBeenCalled();
  });

  it("removes the replaced picture only after the save, and keeps a failed removal quiet", async () => {
    storedRows.mockResolvedValueOnce([{ imageKey: KEY }]);
    saveBannerInDb.mockResolvedValue(savedBanner({ created: false, replacedKey: KEY }));
    removeKeys.mockRejectedValueOnce(new TypeError("network"));

    const result = await saveBanner(bannerInput({ id: ID }));

    expect(result.ok).toBe(true);
    expect(removeKeys).not.toHaveBeenCalled();
    await runAfter();
    expect(removeKeys).toHaveBeenCalledWith([KEY]);
    expect(logged()).toContain(
      JSON.stringify({ event: "banner_media_remove_failed", error: "TypeError" }),
    );
  });

  it("passes the database's refusals through", async () => {
    for (const kind of ["stale", "too_many_banners", "link_not_found", "not_found"]) {
      saveBannerInDb.mockResolvedValueOnce({ kind });
      expect(await saveBanner(bannerInput())).toEqual({ ok: false, error: kind });
    }
  });

  it("turns a database error into failed and never logs the title", async () => {
    saveBannerInDb.mockRejectedValue(new RangeError("boom"));

    expect(await saveBanner(bannerInput())).toEqual({ ok: false, error: "failed" });
    expect(logged().join("\n")).toContain('"error":"RangeError"');
    expect(logged().join("\n")).not.toContain(ALT);
  });
});

describe("deleteBanner", () => {
  it("deletes, then removes the picture after commit", async () => {
    deleteBannerInDb.mockResolvedValue({ kind: "deleted", version: 5, imageKey: KEY });

    expect(await deleteBanner({ version: 4, id: ID.toUpperCase() })).toEqual({
      ok: true,
      data: { version: 5 },
    });
    expect(deleteBannerInDb).toHaveBeenCalledWith(fakeDb, { version: 4, id: ID });
    await runAfter();
    expect(removeKeys).toHaveBeenCalledWith([KEY]);
  });

  it("keeps the picture when the delete is refused", async () => {
    deleteBannerInDb.mockResolvedValue({ kind: "stale" });

    expect(await deleteBanner({ version: 4, id: ID })).toEqual({ ok: false, error: "stale" });
    await runAfter();
    expect(removeKeys).not.toHaveBeenCalled();
  });
});

describe("saveHomepage", () => {
  const page = {
    version: 2,
    banners: [{ id: ID, isActive: true }],
    featured: [ID],
    homeCategoryIds: [],
  };

  it("returns the new version on a save", async () => {
    saveHomepageInDb.mockResolvedValue({ kind: "saved", version: 3 });
    expect(await saveHomepage(page)).toEqual({ ok: true, data: { version: 3 } });
  });

  it("names the products no longer available, and passes the other refusals through", async () => {
    saveHomepageInDb.mockResolvedValueOnce({ kind: "product_unavailable", productIds: [ID] });
    expect(await saveHomepage(page)).toEqual({
      ok: false,
      error: "product_unavailable",
      productIds: [ID],
    });
    for (const kind of ["stale", "too_many_active", "too_many_featured"]) {
      saveHomepageInDb.mockResolvedValueOnce({ kind });
      expect(await saveHomepage(page)).toEqual({ ok: false, error: kind });
    }
  });

  it("turns a database error into failed", async () => {
    saveHomepageInDb.mockRejectedValue(new Error("boom"));
    expect(await saveHomepage(page)).toEqual({ ok: false, error: "failed" });
  });
});
