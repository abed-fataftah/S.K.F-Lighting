import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  banners,
  categories,
  featuredProducts,
  products,
  productVariants,
  shopSettings,
} from "@/server/db/schema";
import { hasLocalDb, withRollback } from "@/server/db/testing";
import type { Database, Transaction } from "@/server/db/types";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { deleteBannerInDb, saveBannerInDb, saveHomepageInDb } = await import("./homepage-db");
const { readFeaturedCards, readHomeBanners, readHomeFeatured } = await import("./home");
const { readHomepageEditor } = await import("./editor-queries");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// covers: AC-2, AC-5, AC-8, AC-9, AC-10, AC-16 (spec 0011)

const uid = () => crypto.randomUUID().slice(0, 8);
const KEY = () => `banners/${crypto.randomUUID()}.webp`;

async function category(tx: Transaction, fields: { parentId?: string; isVisible?: boolean } = {}) {
  const slug = `hp-${uid()}`;
  const [row] = await tx
    .insert(categories)
    .values({
      name: slug,
      slug,
      parentId: fields.parentId ?? null,
      isVisible: fields.isVisible ?? true,
    })
    .returning();
  return row;
}

async function product(
  tx: Transaction,
  categoryId: string,
  fields: { status?: "active" | "hidden" | "archived"; available?: boolean } = {},
) {
  const code = `HP-${uid().toUpperCase()}`;
  const [row] = await tx
    .insert(products)
    .values({
      categoryId,
      code,
      name: `منتج ${code}`,
      slug: `hp-${code}`,
      status: fields.status ?? "active",
    })
    .returning();
  await tx.insert(productVariants).values({
    productId: row.id,
    price: 10_000,
    isDefault: true,
    isAvailable: fields.available ?? true,
  });
  return row;
}

const version = async (tx: Database | Transaction) =>
  (await tx.select({ v: shopSettings.homeVersion }).from(shopSettings))[0].v;

/** Starts each test from no banners and no picks, inside its rolled back transaction. */
async function clean(tx: Transaction) {
  await tx.delete(banners);
  await tx.delete(featuredProducts);
}

async function addBanner(
  tx: Transaction,
  link: Parameters<typeof saveBannerInDb>[1]["link"] = { kind: "none" },
) {
  const outcome = await saveBannerInDb(tx, {
    version: await version(tx),
    imageKey: KEY(),
    alt: `بانر ${uid()}`,
    link,
  });
  if (outcome.kind !== "saved") throw new Error(`expected saved, got ${outcome.kind}`);
  return outcome;
}

describe.skipIf(!hasLocalDb)("saveBannerInDb", () => {
  it("adds banners last, active while under five, and bumps the version once each", async () => {
    await withRollback(db, async (tx) => {
      await clean(tx);
      const start = await version(tx);
      const made = [];
      for (let i = 0; i < 6; i++) made.push(await addBanner(tx));

      expect(made.map((m) => m.banner.isActive)).toEqual([true, true, true, true, true, false]);
      expect(made.at(-1)?.version).toBe(start + 6);
      const rows = await tx.select().from(banners).orderBy(banners.sort);
      expect(rows.map((row) => row.sort)).toEqual([0, 1, 2, 3, 4, 5]);
    });
  });

  it("refuses an eleventh banner and an older version", async () => {
    await withRollback(db, async (tx) => {
      await clean(tx);
      for (let i = 0; i < 10; i++) await addBanner(tx);
      const v = await version(tx);
      const input = { imageKey: KEY(), alt: "بانر زائد", link: { kind: "none" } as const };
      expect(await saveBannerInDb(tx, { version: v, ...input })).toEqual({
        kind: "too_many_banners",
      });
      expect(await saveBannerInDb(tx, { version: v - 1, ...input })).toEqual({ kind: "stale" });
      expect(await version(tx)).toBe(v);
    });
  });

  it("edits by id, hands back the replaced picture, and refuses a missing target", async () => {
    await withRollback(db, async (tx) => {
      await clean(tx);
      const main = await category(tx);
      const { banner } = await addBanner(tx);
      const imageKey = KEY();
      const edited = await saveBannerInDb(tx, {
        version: await version(tx),
        id: banner.id,
        imageKey,
        alt: "عنوان جديد",
        link: { kind: "category", id: main.id },
      });
      expect(edited).toMatchObject({
        kind: "saved",
        created: false,
        replacedKey: banner.imageKey,
        banner: {
          id: banner.id,
          alt: "عنوان جديد",
          link: { kind: "category", id: main.id, live: true },
        },
      });
      expect(
        await saveBannerInDb(tx, {
          version: await version(tx),
          id: banner.id,
          imageKey,
          alt: "عنوان جديد",
          link: { kind: "product", id: crypto.randomUUID() },
        }),
      ).toEqual({ kind: "link_not_found" });
    });
  });

  it("deletes a banner and hands back its picture", async () => {
    await withRollback(db, async (tx) => {
      await clean(tx);
      const { banner, version: v } = await addBanner(tx);
      expect(await deleteBannerInDb(tx, { version: v - 1, id: banner.id })).toEqual({
        kind: "stale",
      });
      expect(await deleteBannerInDb(tx, { version: v, id: banner.id })).toEqual({
        kind: "deleted",
        version: v + 1,
        imageKey: banner.imageKey,
      });
      expect(await deleteBannerInDb(tx, { version: v + 1, id: banner.id })).toEqual({
        kind: "not_found",
      });
    });
  });

  it("clears a banner's link when its category or product is deleted", async () => {
    await withRollback(db, async (tx) => {
      await clean(tx);
      const main = await category(tx);
      const other = await category(tx);
      const item = await product(tx, other.id);
      const toCategory = await addBanner(tx, { kind: "category", id: main.id });
      const toProduct = await addBanner(tx, { kind: "product", id: item.id });

      await tx.delete(categories).where(eq(categories.id, main.id));
      await tx.delete(products).where(eq(products.id, item.id));

      const rows = await tx
        .select()
        .from(banners)
        .where(inArray(banners.id, [toCategory.banner.id, toProduct.banner.id]));
      expect(rows.map((row) => [row.linkCategoryId, row.linkProductId])).toEqual([
        [null, null],
        [null, null],
      ]);
      const editor = await readHomepageEditor(tx);
      expect(editor.banners.map((row) => row.link)).toEqual([null, null]);
    });
  });
});

describe.skipIf(!hasLocalDb)("two tabs racing for the tenth banner", () => {
  it("lets one in and turns the other away, leaving ten", async () => {
    const second = getDirectDb();
    const ids: string[] = [];
    try {
      const before = await db.select({ id: banners.id }).from(banners);
      if (before.length) return; // Another run left banners behind; do not touch real data.
      for (let i = 0; i < 9; i++) {
        const made = await saveBannerInDb(db, {
          version: await version(db),
          imageKey: KEY(),
          alt: `سباق ${i}`,
          link: { kind: "none" },
        });
        if (made.kind === "saved") ids.push(made.banner.id);
      }
      const v = await version(db);
      const input = (alt: string) => ({
        version: v,
        imageKey: KEY(),
        alt,
        link: { kind: "none" } as const,
      });
      const outcomes = await Promise.all([
        saveBannerInDb(db, input("التبويب أ")),
        saveBannerInDb(second, input("التبويب ب")),
      ]);
      for (const outcome of outcomes) if (outcome.kind === "saved") ids.push(outcome.banner.id);

      expect(outcomes.map((o) => o.kind).sort()).toEqual(["saved", "stale"]);
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)`.mapWith(Number) })
        .from(banners);
      expect(total).toBe(10);
    } finally {
      if (ids.length) await db.delete(banners).where(inArray(banners.id, ids));
      await second.$client.end();
    }
  });
});

describe.skipIf(!hasLocalDb)("saveHomepageInDb", () => {
  it("writes the banner order and ticks, the picks in order, and the Home mains together", async () => {
    await withRollback(db, async (tx) => {
      await clean(tx);
      const shown = await category(tx);
      const off = await category(tx);
      const [a, b] = [await addBanner(tx), await addBanner(tx)];
      const [p1, p2] = [
        await product(tx, shown.id),
        await product(tx, shown.id, { status: "hidden" }),
      ];
      const v = await version(tx);

      const outcome = await saveHomepageInDb(tx, {
        version: v,
        banners: [
          { id: b.banner.id, isActive: true },
          { id: a.banner.id, isActive: false },
        ],
        featured: [p2.id, p1.id],
        homeCategoryIds: [shown.id],
      });

      expect(outcome).toEqual({ kind: "saved", version: v + 1 });
      const rows = await tx.select().from(banners).orderBy(banners.sort);
      expect(rows.map((row) => [row.id, row.isActive])).toEqual([
        [b.banner.id, true],
        [a.banner.id, false],
      ]);
      const picks = await tx.select().from(featuredProducts).orderBy(featuredProducts.sort);
      expect(picks.map((pick) => pick.productId)).toEqual([p2.id, p1.id]);
      const mains = await tx
        .select({ id: categories.id, showOnHome: categories.showOnHome })
        .from(categories)
        .where(inArray(categories.id, [shown.id, off.id]));
      expect(Object.fromEntries(mains.map((m) => [m.id, m.showOnHome]))).toEqual({
        [shown.id]: true,
        [off.id]: false,
      });
    });
  });

  it("refuses stale, a sixth active banner, and an archived or deleted pick, writing nothing", async () => {
    await withRollback(db, async (tx) => {
      await clean(tx);
      const main = await category(tx);
      const made = [];
      for (let i = 0; i < 6; i++) made.push(await addBanner(tx));
      const archived = await product(tx, main.id, { status: "archived" });
      const v = await version(tx);
      const input = {
        version: v,
        banners: made.map((m) => ({ id: m.banner.id, isActive: m.banner.isActive })),
        featured: [] as string[],
        homeCategoryIds: [main.id],
      };

      expect(await saveHomepageInDb(tx, { ...input, version: v - 1 })).toEqual({ kind: "stale" });
      expect(
        await saveHomepageInDb(tx, {
          ...input,
          banners: input.banners.map((banner) => ({ ...banner, isActive: true })),
        }),
      ).toEqual({ kind: "too_many_active" });
      const gone = crypto.randomUUID();
      expect(await saveHomepageInDb(tx, { ...input, featured: [archived.id, gone] })).toEqual({
        kind: "product_unavailable",
        productIds: [archived.id, gone],
      });
      expect(await version(tx)).toBe(v);
      expect(await tx.select().from(featuredProducts)).toEqual([]);
    });
  });

  it("maps a pick deleted between the check and the insert (23503) to product_unavailable", async () => {
    await withRollback(db, async (tx) => {
      await clean(tx);
      const main = await category(tx);
      const kept = await product(tx, main.id);
      const gone = crypto.randomUUID();
      // The transaction loses the race: its insert meets the foreign key, as a concurrent delete would.
      const racing = new Proxy(tx, {
        get(target, key, receiver) {
          if (key !== "transaction") return Reflect.get(target, key, receiver);
          return async () => {
            throw Object.assign(new Error("insert or update violates foreign key constraint"), {
              code: "23503",
            });
          };
        },
      });

      expect(
        await saveHomepageInDb(racing, {
          version: await version(tx),
          banners: [],
          featured: [kept.id, gone],
          homeCategoryIds: [],
        }),
      ).toEqual({ kind: "product_unavailable", productIds: [gone] });
    });
  });
});

describe.skipIf(!hasLocalDb)("Home's reads", () => {
  it("shows only listed picks in order, out of stock ones too, else the newest eight", async () => {
    await withRollback(db, async (tx) => {
      await clean(tx);
      const main = await category(tx);
      const hiddenMain = await category(tx, { isVisible: false });
      const listed = await product(tx, main.id);
      const outOfStock = await product(tx, main.id, { available: false });
      const hidden = await product(tx, main.id, { status: "hidden" });
      const archived = await product(tx, main.id, { status: "archived" });
      const inHidden = await product(tx, hiddenMain.id);
      await tx.insert(featuredProducts).values(
        [outOfStock, hidden, listed, archived, inHidden].map((row, sort) => ({
          productId: row.id,
          sort,
        })),
      );

      const cards = await readFeaturedCards(tx);
      expect(cards.map((card) => [card.slug, card.inStock])).toEqual([
        [outOfStock.slug, false],
        [listed.slug, true],
      ]);

      await tx.delete(featuredProducts);
      const fallback = await readHomeFeatured(tx);
      expect(fallback.length).toBeLessThanOrEqual(8);
      expect(fallback.map((card) => card.slug)).toContain(listed.slug);
      expect(fallback.map((card) => card.slug)).not.toContain(outOfStock.slug);
    });
  });

  it("shows at most five active banners and links only a live target", async () => {
    await withRollback(db, async (tx) => {
      await clean(tx);
      const main = await category(tx);
      const hiddenMain = await category(tx, { isVisible: false });
      const sub = await category(tx, { parentId: main.id });
      const live = await addBanner(tx, { kind: "category", id: sub.id });
      const notLive = await addBanner(tx, { kind: "category", id: hiddenMain.id });
      for (let i = 0; i < 4; i++) await addBanner(tx);

      const shown = await readHomeBanners(tx);
      expect(shown).toHaveLength(5);
      expect(shown[0]).toMatchObject({ id: live.banner.id, href: `/c/${main.slug}/${sub.slug}` });
      expect(shown[1]).toMatchObject({ id: notLive.banner.id, href: null });
    });
  });
});
