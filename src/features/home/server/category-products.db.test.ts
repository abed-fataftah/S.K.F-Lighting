import { afterAll, describe, expect, it, vi } from "vitest";
import { compareListedProducts } from "@/features/catalog/card-view";
import { categories, products, productVariants } from "@/server/db/schema";
import { hasLocalDb, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { readHomeCategoryProducts } = await import("./category-products");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// covers: AC-6, AC-11 (spec 0031)

const uid = () => crypto.randomUUID().slice(0, 8);

async function category(tx: Transaction, fields: { parentId?: string; isVisible?: boolean } = {}) {
  const slug = `hc-${uid()}`;
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
  fields: {
    status?: "active" | "hidden" | "archived";
    available?: boolean;
    createdAt: Date;
  },
) {
  const code = `HC-${uid().toUpperCase()}`;
  const [row] = await tx
    .insert(products)
    .values({
      categoryId,
      code,
      name: `منتج ${code}`,
      slug: `hc-${code.toLowerCase()}`,
      status: fields.status ?? "active",
      createdAt: fields.createdAt,
    })
    .returning();
  await tx.insert(productVariants).values({
    productId: row.id,
    price: 10_000,
    isDefault: true,
    isAvailable: fields.available ?? true,
  });
  return {
    id: row.id,
    slug: row.slug,
    createdAt: row.createdAt,
    inStock: fields.available ?? true,
  };
}

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

describe.skipIf(!hasLocalDb)("readHomeCategoryProducts", () => {
  it("lists the main's and its subs' listed products, in stock first then newest, at most eight", async () => {
    await withRollback(db, async (tx) => {
      const main = await category(tx);
      const sub = await category(tx, { parentId: main.id });
      const hiddenSub = await category(tx, { parentId: main.id, isVisible: false });
      const listed = [
        await product(tx, main.id, { createdAt: day(1) }),
        await product(tx, sub.id, { createdAt: day(9) }),
        await product(tx, main.id, { createdAt: day(5), available: false }),
        ...(await Promise.all(
          Array.from({ length: 7 }, (_, i) => product(tx, sub.id, { createdAt: day(10 + i) })),
        )),
      ];
      // Never listed: hidden, archived, or in a hidden sub.
      await product(tx, main.id, { createdAt: day(20), status: "hidden" });
      await product(tx, main.id, { createdAt: day(21), status: "archived" });
      await product(tx, hiddenSub.id, { createdAt: day(22) });

      const cards = await readHomeCategoryProducts(tx, [main.id, sub.id, hiddenSub.id]);

      const expected = [...listed].sort(compareListedProducts).slice(0, 8);
      expect(cards.map((card) => card.slug)).toEqual(expected.map((row) => row.slug));
      expect(cards).toHaveLength(8);
    });
  });

  it("keeps an out of stock product, after the ones in stock", async () => {
    await withRollback(db, async (tx) => {
      const main = await category(tx);
      const out = await product(tx, main.id, { createdAt: day(9), available: false });
      const inStock = await product(tx, main.id, { createdAt: day(1) });

      const cards = await readHomeCategoryProducts(tx, [main.id]);

      expect(cards.map((card) => [card.slug, card.inStock])).toEqual([
        [inStock.slug, true],
        [out.slug, false],
      ]);
    });
  });

  it("reads nothing for no category", async () => {
    expect(await readHomeCategoryProducts(db, [])).toEqual([]);
  });
});
