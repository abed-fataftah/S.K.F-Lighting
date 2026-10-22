import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { categories, products, productVariants } from "@/server/db/schema";
import { hasLocalDb, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";
import { compareListedProducts } from "../card-view";
import { isCategoryShown } from "../category-rules";
import { isSellable } from "../sellable";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { parentCategory, sellableVariant } = await import("./storefront-sql");
const { readCartRows } = await import("@/features/cart/server/cart-rows");
const { readCatalogTree, readCategoryPage, readHomeProducts, readProductBySlug } =
  await import("./queries");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// covers: AC-6, AC-7, AC-8, AC-10, AC-11, AC-12, AC-14 (spec 0008)

const uid = () => crypto.randomUUID().slice(0, 8);

async function category(
  tx: Transaction,
  fields: { name?: string; parentId?: string | null; isVisible?: boolean; sort?: number } = {},
) {
  const slug = `sft-${uid()}`;
  const [row] = await tx
    .insert(categories)
    .values({ name: fields.name ?? slug, slug, parentId: fields.parentId ?? null, ...fields })
    .returning();
  return row;
}

async function product(
  tx: Transaction,
  categoryId: string,
  fields: {
    status?: "active" | "hidden" | "archived";
    isAvailable?: boolean;
    createdAt?: Date;
    variants?: readonly { price: number; isAvailable?: boolean; archivedAt?: Date | null }[];
  } = {},
) {
  const code = `SFT-${uid().toUpperCase()}`;
  const [row] = await tx
    .insert(products)
    .values({
      categoryId,
      code,
      name: `منتج ${code}`,
      slug: `sft-product-${code}`,
      status: fields.status ?? "active",
      isAvailable: fields.isAvailable ?? true,
      ...(fields.createdAt ? { createdAt: fields.createdAt } : {}),
    })
    .returning();
  const variants = fields.variants ?? [{ price: 10_000 }];
  const made = await tx
    .insert(productVariants)
    .values(
      variants.map((variant, sort) => ({
        productId: row.id,
        price: variant.price,
        isAvailable: variant.isAvailable ?? true,
        archivedAt: variant.archivedAt ?? null,
        isDefault: sort === 0,
        sort,
        sizeLabel: variants.length > 1 ? `${sort + 1}` : null,
      })),
    )
    .returning();
  return { ...row, variants: made };
}

describe.skipIf(!hasLocalDb)("the sellable rule in code and in SQL", () => {
  it("gives the same answer for every combination", async () => {
    await withRollback(db, async (tx) => {
      const shownMain = await category(tx);
      const hiddenMain = await category(tx, { isVisible: false });
      const places = [
        { category: shownMain, parent: null },
        { category: hiddenMain, parent: null },
        ...(await Promise.all(
          [shownMain, hiddenMain].flatMap((main) =>
            [true, false].map(async (isVisible) => ({
              category: await category(tx, { parentId: main.id, isVisible }),
              parent: main,
            })),
          ),
        )),
      ];

      const cases: { variantId: string; expected: boolean }[] = [];
      for (const place of places) {
        for (const status of ["active", "hidden", "archived"] as const) {
          for (const isAvailable of [true, false]) {
            for (const variantAvailable of [true, false]) {
              for (const archived of [false, true]) {
                const made = await product(tx, place.category.id, {
                  status,
                  isAvailable,
                  variants: [
                    {
                      price: 1_000,
                      isAvailable: variantAvailable,
                      archivedAt: archived ? new Date() : null,
                    },
                  ],
                });
                const variant = made.variants[0];
                cases.push({
                  variantId: variant.id,
                  expected: isSellable(
                    {
                      status,
                      isAvailable,
                      categoryShown: isCategoryShown(place.category, place.parent),
                    },
                    variant,
                  ),
                });
              }
            }
          }
        }
      }

      const rows = await tx
        .select({
          variantId: productVariants.id,
          sellable: sql<boolean>`${sellableVariant}`.mapWith(Boolean),
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .innerJoin(categories, eq(categories.id, products.categoryId))
        .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
        .where(
          inArray(
            productVariants.id,
            cases.map((c) => c.variantId),
          ),
        );
      const fromSql = new Map(rows.map((row) => [row.variantId, row.sellable]));
      expect(cases.length).toBe(6 * 3 * 2 * 2 * 2);
      expect(cases.filter((c) => fromSql.get(c.variantId) !== c.expected)).toEqual([]);
      expect(cases.some((c) => c.expected)).toBe(true);

      // The cart reads the same rule: a line's category shown flag matches the code.
      const cart = await readCartRows(
        tx,
        cases.map((c) => c.variantId),
      );
      const { buildCartView } = await import("@/features/cart/cart-view");
      const view = buildCartView(
        cases.map((c) => ({ variantId: c.variantId, quantity: 1 })),
        cart,
      );
      expect(view.lines.map((line) => line.sellable)).toEqual(cases.map((c) => c.expected));
    });
  });
});

describe.skipIf(!hasLocalDb)("hidden means hidden", () => {
  it("leaves a hidden main's and a hidden sub's products out of home and their pages", async () => {
    await withRollback(db, async (tx) => {
      const later = new Date(Date.UTC(2099, 0, 1));
      const shown = await category(tx);
      const hiddenMain = await category(tx, { isVisible: false });
      const subOfHidden = await category(tx, { parentId: hiddenMain.id });
      const hiddenSub = await category(tx, { parentId: shown.id, isVisible: false });

      const visible = await product(tx, shown.id, { createdAt: later });
      const underHiddenMain = await product(tx, subOfHidden.id, { createdAt: later });
      const inHiddenSub = await product(tx, hiddenSub.id, { createdAt: later });

      const home = (await readHomeProducts(tx)).map((card) => card.slug);
      expect(home).toContain(visible.slug);
      expect(home).not.toContain(underHiddenMain.slug);
      expect(home).not.toContain(inHiddenSub.slug);

      expect(await readProductBySlug(tx, visible.slug)).toMatchObject({
        category: { href: `/c/${encodeURIComponent(shown.slug)}` },
      });
      expect(await readProductBySlug(tx, underHiddenMain.slug)).toBeNull();
      expect(await readProductBySlug(tx, inHiddenSub.slug)).toBeNull();

      // Showing the main again brings its sub back, with no write to the sub.
      await tx.update(categories).set({ isVisible: true }).where(eq(categories.id, hiddenMain.id));
      expect(await readProductBySlug(tx, underHiddenMain.slug)).not.toBeNull();
    });
  });
});

describe.skipIf(!hasLocalDb)("category pages", () => {
  it("opens a shown main and its sub, and refuses the addresses AC-8 lists", async () => {
    await withRollback(db, async (tx) => {
      const main = await category(tx, { name: "ثريات" });
      const other = await category(tx);
      const sub = await category(tx, { parentId: main.id, name: "كريستال" });
      const emptySub = await category(tx, { parentId: main.id, name: "مودرن" });
      const hiddenSub = await category(tx, { parentId: main.id, isVisible: false });
      const hiddenMain = await category(tx, { isVisible: false });
      await product(tx, main.id);
      await product(tx, sub.id);
      await product(tx, hiddenSub.id);
      await product(tx, sub.id, { status: "hidden" });
      await product(tx, sub.id, { status: "archived" });

      const tree = await readCatalogTree(tx);
      const page = await readCategoryPage(tx, tree, main.slug, null, 1);
      expect(page).toMatchObject({
        main: { slug: main.slug, name: "ثريات" },
        sub: null,
        total: 2,
        navSubs: [{ slug: sub.slug, name: "كريستال", productCount: 1 }],
      });
      expect(page?.products).toHaveLength(2);

      const subPage = await readCategoryPage(tx, tree, main.slug, sub.slug, 1);
      expect(subPage).toMatchObject({ sub: { slug: sub.slug }, total: 1 });

      // A shown sub outside navigation opens empty, and its chip is added after the others.
      const empty = await readCategoryPage(tx, tree, main.slug, emptySub.slug, 1);
      expect(empty).toMatchObject({ total: 0, products: [] });
      expect(empty?.chipSubs.map((chip) => chip.slug)).toEqual([sub.slug, emptySub.slug]);

      expect(await readCategoryPage(tx, tree, "sft-missing", null, 1)).toBeNull();
      expect(await readCategoryPage(tx, tree, hiddenMain.slug, null, 1)).toBeNull();
      expect(await readCategoryPage(tx, tree, main.slug, hiddenSub.slug, 1)).toBeNull();
      expect(await readCategoryPage(tx, tree, other.slug, sub.slug, 1)).toBeNull();
      expect(await readCategoryPage(tx, tree, sub.slug, null, 1)).toBeNull();
    });
  });

  it("lists in stock first, newest first, and pages 24 at a time", async () => {
    await withRollback(db, async (tx) => {
      const main = await category(tx);
      const made = [];
      for (let i = 0; i < 30; i += 1) {
        made.push(
          await product(tx, main.id, {
            createdAt: new Date(Date.UTC(2030, 0, 1 + i)),
            isAvailable: i % 4 !== 0,
          }),
        );
      }
      const tree = await readCatalogTree(tx);

      const first = await readCategoryPage(tx, tree, main.slug, null, 1);
      expect(first).toMatchObject({ total: 30, page: 1 });
      expect(first?.products).toHaveLength(24);

      const expected = made
        .map((p) => ({ id: p.id, slug: p.slug, createdAt: p.createdAt, inStock: p.isAvailable }))
        .sort(compareListedProducts)
        .map((p) => p.slug);
      const all = await readCategoryPage(tx, tree, main.slug, null, 2);
      expect(all?.products.map((card) => card.slug)).toEqual(expected);

      // A page past the last shows everything, as the last page.
      expect(await readCategoryPage(tx, tree, main.slug, null, 9)).toMatchObject({ page: 2 });
    });
  });

  it("builds each card from its live variants and first photo", async () => {
    await withRollback(db, async (tx) => {
      const main = await category(tx);
      const sized = await product(tx, main.id, {
        variants: [{ price: 20_000 }, { price: 15_000 }, { price: 900, isAvailable: false }],
      });
      await tx
        .update(products)
        .set({
          specs: [
            { label: "القطر", value: "60 سم" },
            { label: "اللون", value: " " },
            { label: "القاعدة", value: "E27" },
          ],
        })
        .where(eq(products.id, sized.id));
      const out = await product(tx, main.id, {
        isAvailable: false,
        variants: [{ price: 7_000 }],
      });
      const tree = await readCatalogTree(tx);
      const page = await readCategoryPage(tx, tree, main.slug, null, 1);
      const cardOf = (slug: string) => page?.products.find((card) => card.slug === slug);

      expect(cardOf(sized.slug)).toMatchObject({
        chips: ["60 سم", "E27"],
        listPrice: 15_000,
        pricesDiffer: true,
        inStock: true,
        addVariantId: sized.variants[1].id,
        imageKey: null,
      });
      expect(cardOf(out.slug)).toMatchObject({
        inStock: false,
        listPrice: 7_000,
        pricesDiffer: false,
        addVariantId: null,
      });
      expect(page?.products.map((card) => card.slug)).toEqual([sized.slug, out.slug]);
    });
  });
});
