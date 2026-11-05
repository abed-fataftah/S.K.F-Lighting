import { afterAll, describe, expect, it, vi } from "vitest";
import { categories, colours, products, productVariants } from "@/server/db/schema";
import { hasLocalDb, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";
import { EMPTY_FILTERS, parseListFilters, type ListFilters } from "../list-filters";
import { readSearchRequest } from "../search-text";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { refreshSearchKeys } = await import("./search-keys");
const { readFilterChoices, readListCount, readListView } = await import("./queries");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// covers: AC-8, AC-9, AC-10, AC-12, AC-16 (spec 0010)

const uid = () => crypto.randomUUID().slice(0, 8);

type Option = {
  readonly size?: string | null;
  readonly colourId?: string | null;
  readonly price?: number;
  readonly isAvailable?: boolean;
  readonly archivedAt?: Date | null;
};

/** One shown category with its own colours, and a helper to add products to it. */
async function shop(tx: Transaction) {
  const slug = `tlf-${uid()}`;
  const [category] = await tx.insert(categories).values({ name: slug, slug }).returning();
  const made = await tx
    .insert(colours)
    .values([
      { name: `ذهبي ${slug}`, hex: null, sort: 1 },
      { name: `أسود ${slug}`, hex: null, sort: 0 },
      { name: `أحمر ${slug}`, hex: null, sort: 2 },
    ])
    .returning();
  const [gold, black, red] = made;

  async function product(
    name: string,
    options: readonly Option[],
    fields: { readonly isAvailable?: boolean; readonly createdAt?: Date } = {},
  ) {
    const code = `TLF-${uid().toUpperCase()}`;
    const [row] = await tx
      .insert(products)
      .values({
        categoryId: category.id,
        code,
        name,
        slug: `tlf-${code.toLowerCase()}`,
        isAvailable: fields.isAvailable ?? true,
        ...(fields.createdAt ? { createdAt: fields.createdAt } : {}),
      })
      .returning();
    await tx.insert(productVariants).values(
      options.map((option, sort) => ({
        productId: row.id,
        sizeLabel: option.size ?? null,
        colourId: option.colourId ?? null,
        price: option.price ?? 10_000,
        isAvailable: option.isAvailable ?? true,
        archivedAt: option.archivedAt ?? null,
        isDefault: sort === 0,
        sort,
      })),
    );
    await refreshSearchKeys(tx, row.id);
    return row;
  }

  const scope = { kind: "category" as const, categoryIds: [category.id] };
  const codes = async (filters: ListFilters) =>
    (await readListView(tx, scope, filters, 1)).products.map((card) => card.code).sort();
  return { category, gold, black, red, product, scope, codes };
}

const address = (query: string) => parseListFilters(new URLSearchParams(query));

describe.skipIf(!hasLocalDb)("list filters on the local database", () => {
  it("checks every filter against one single option, never across options", async () => {
    await withRollback(db, async (tx) => {
      const s = await shop(tx);
      // 60 cm in black, and gold only in 80 cm: no single option is 60 cm and gold.
      await s.product("ثريا مقسومة", [
        { size: "60 سم", colourId: s.black.id },
        { size: "80 سم", colourId: s.gold.id },
      ]);
      const both = await s.product("ثريا كاملة", [{ size: "60 سم", colourId: s.gold.id }]);

      expect(await s.codes(address(`size=60سم&colour=${s.gold.name}`))).toEqual([both.code]);
      expect(await s.codes(address("size=60سم"))).toHaveLength(2);
    });
  });

  it("means either one inside a filter and all of them across filters", async () => {
    await withRollback(db, async (tx) => {
      const s = await shop(tx);
      const gold = await s.product("لمبه", [{ colourId: s.gold.id }]);
      const black = await s.product("لمبه", [{ colourId: s.black.id }]);
      await s.product("لمبه", [{ colourId: s.red.id }]);

      expect(await s.codes(address(`colour=${s.gold.name}&colour=${s.black.name}`))).toEqual(
        [gold.code, black.code].sort(),
      );
    });
  });

  it("with available=1 keeps only products with a sellable matching option", async () => {
    await withRollback(db, async (tx) => {
      const s = await shop(tx);
      const sellable = await s.product("لمبه", [{ colourId: s.gold.id }]);
      await s.product("لمبه", [{ colourId: s.gold.id, isAvailable: false }]);
      await s.product("لمبه", [{ colourId: s.gold.id }], { isAvailable: false });
      // Sellable in black only: gold is out, so "gold and available" misses it.
      await s.product("لمبه", [
        { colourId: s.gold.id, isAvailable: false },
        { colourId: s.black.id },
      ]);

      expect(await s.codes(address(`colour=${s.gold.name}&available=1`))).toEqual([sellable.code]);
      expect(await s.codes(address(`colour=${s.gold.name}`))).toHaveLength(4);
    });
  });

  it("holds price bounds inclusive in agorot, over live options only", async () => {
    await withRollback(db, async (tx) => {
      const s = await shop(tx);
      const low = await s.product("لمبه", [{ price: 10_000 }]);
      const high = await s.product("لمبه", [{ price: 20_000 }]);
      await s.product("لمبه", [{ price: 20_001 }]);
      await s.product("لمبه", [
        { size: "كبير", price: 50_000 },
        { size: "صغير", price: 15_000, archivedAt: new Date() },
      ]);

      expect(await s.codes(address("min=100&max=200"))).toEqual([low.code, high.code].sort());
      expect(await s.codes(address("max=100"))).toEqual([low.code]);
    });
  });

  it("offers the unfiltered list's sizes, colours, and price range", async () => {
    await withRollback(db, async (tx) => {
      const s = await shop(tx);
      await s.product("لمبه", [
        { size: "60 سم", colourId: s.gold.id, price: 4_550 },
        { size: "كبير", colourId: s.black.id, price: 89_001 },
        { size: "2.5 سم", colourId: s.red.id, archivedAt: new Date(), price: 100 },
      ]);
      await s.product("لمبه", [{ size: "60سم", price: 9_900 }]);
      await s.product("لمبه", [{ size: "60سم", price: 9_900 }]);

      const choices = await readFilterChoices(tx, s.scope);
      expect(choices.sizes).toEqual([
        { key: "60سم", label: "60سم" },
        { key: "كبير", label: "كبير" },
      ]);
      expect(choices.colours.map((colour) => colour.name)).toEqual([s.black.name, s.gold.name]);
      expect(choices.price).toEqual({ min: 45, max: 891 });
    });
  });

  it("drops unknown sizes and colours, so an old link opens a useful list", async () => {
    await withRollback(db, async (tx) => {
      const s = await shop(tx);
      await s.product("لمبه", [{ colourId: s.gold.id }]);
      await s.product("لمبه", [{ colourId: s.black.id }]);

      const view = await readListView(tx, s.scope, address("colour=بنفسجي&size=999سم"), 1);
      expect(view.filters).toMatchObject({ sizes: [], colours: [] });
      expect(view.total).toBe(2);
    });
  });

  it("counts exactly the M the page shows, for a category and a search", async () => {
    await withRollback(db, async (tx) => {
      const s = await shop(tx);
      const t = `q${uid()}`;
      await s.product(`ثريا ${t}`, [{ size: "60 سم", colourId: s.gold.id, price: 15_000 }]);
      await s.product(`ثريا ${t}`, [{ size: "80 سم", colourId: s.gold.id, price: 25_000 }]);
      await s.product(`ثريا ${t}`, [{ size: "60 سم", colourId: s.black.id, isAvailable: false }]);
      const request = readSearchRequest(`ثريا ${t}`);
      if (request.kind !== "search") throw new Error("not searchable");
      const search = { ...request, kind: "search" as const };

      for (const query of [
        "",
        "size=60سم",
        `colour=${s.gold.name}&max=200`,
        "available=1",
        "size=999سم",
      ]) {
        const parsed = address(query);
        for (const scope of [s.scope, search]) {
          const view = await readListView(tx, scope, parsed, 1);
          expect(await readListCount(tx, scope, parsed), `${scope.kind} ${query}`).toBe(view.total);
        }
      }
      expect((await readListView(tx, s.scope, EMPTY_FILTERS, 1)).total).toBe(3);
    });
  });
});
