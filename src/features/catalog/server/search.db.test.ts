import { and, asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { categories, products, productVariants } from "@/server/db/schema";
import { hasLocalDb, withRollback } from "@/server/db/testing";
import type { Database, Transaction } from "@/server/db/types";
import { EMPTY_FILTERS } from "../list-filters";
import { productEditorSchema, type ProductEditorInput } from "../schemas";
import { buildSearchText, readSearchRequest, searchTier, type SearchTerms } from "../search-text";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { saveProductInDb } = await import("./save-product");
const { importProductInDb } = await import("./import-products");
const { backfillSearchKeys, refreshSearchKeys } = await import("./search-keys");
const { readListView } = await import("./queries");

const db = hasLocalDb ? getDirectDb() : (null as never);

// covers: AC-3, AC-4, AC-7, AC-16 (spec 0010)

type Db = Database | Transaction;

// The editor saves into a category made on the categories page: one committed test category.
const SEARCH_CATEGORY = { name: "فئة اختبار البحث", slug: "test-search-category" };
let searchCategoryId = "";

beforeAll(async () => {
  if (!hasLocalDb) return;
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, SEARCH_CATEGORY.slug));
  searchCategoryId =
    existing?.id ??
    (await db.insert(categories).values(SEARCH_CATEGORY).returning({ id: categories.id }))[0].id;
});

afterAll(async () => {
  if (!hasLocalDb) return;
  await db.delete(categories).where(eq(categories.slug, SEARCH_CATEGORY.slug));
  await db.$client.end();
});

/** A token no other product holds, so a search sees only this test's rows. */
const tag = () => `q${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;

const editorInput = (fields: Partial<ProductEditorInput>) =>
  productEditorSchema.parse({
    id: crypto.randomUUID(),
    version: null,
    name: "ثريا اختبار",
    code: `TSR-${crypto.randomUUID().slice(0, 8)}`,
    categoryId: searchCategoryId,
    specs: [],
    visible: true,
    available: true,
    price: "100",
    sizes: [],
    colours: [],
    pairs: [],
    media: [],
    ...fields,
  });

async function keysOf(tx: Db, productId: string) {
  const [product] = await tx
    .select({ searchText: products.searchText })
    .from(products)
    .where(eq(products.id, productId));
  const options = await tx
    .select({ sizeLabel: productVariants.sizeLabel, sizeKey: productVariants.sizeKey })
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.sizeSort));
  return { searchText: product.searchText, options };
}

async function shownCategory(
  tx: Transaction,
  fields: Partial<typeof categories.$inferInsert> = {},
) {
  const slug = `tsr-${crypto.randomUUID().slice(0, 8)}`;
  const [row] = await tx
    .insert(categories)
    .values({ name: slug, slug, ...fields })
    .returning();
  return row;
}

/** A product inserted directly, then given its keys the way every save does. */
async function product(
  tx: Transaction,
  fields: {
    readonly name: string;
    readonly code?: string;
    readonly categoryId: string;
    readonly status?: "active" | "hidden" | "archived";
    readonly createdAt?: Date;
    readonly options?: readonly {
      readonly code?: string;
      readonly archivedAt?: Date | null;
    }[];
  },
) {
  const code = fields.code ?? `TSR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const [row] = await tx
    .insert(products)
    .values({
      categoryId: fields.categoryId,
      code,
      name: fields.name,
      slug: `tsr-${code.toLowerCase()}`,
      status: fields.status ?? "active",
      ...(fields.createdAt ? { createdAt: fields.createdAt } : {}),
    })
    .returning();
  const options = fields.options ?? [{}];
  await tx.insert(productVariants).values(
    options.map((option, sort) => ({
      productId: row.id,
      price: 10_000,
      code: option.code ?? null,
      archivedAt: option.archivedAt ?? null,
      isDefault: sort === 0,
      sizeLabel: options.length > 1 ? `${sort + 1}` : null,
      sort,
    })),
  );
  await refreshSearchKeys(tx, row.id);
  return row;
}

function terms(text: string): SearchTerms {
  const request = readSearchRequest(text);
  if (request.kind !== "search") throw new Error(`not searchable: ${text}`);
  return request;
}

const searchList = (tx: Db, text: string, page = 1) =>
  readListView(tx, { kind: "search", ...terms(text) }, EMPTY_FILTERS, page);

const searchCodes = async (tx: Db, text: string) =>
  (await searchList(tx, text)).products.map((card) => card.code);

describe.skipIf(!hasLocalDb)("the stored search keys", () => {
  it("are written by the editor save and follow a rename and a size relabel", async () => {
    await withRollback(db, async (tx) => {
      const data = editorInput({
        name: "إنارةُ حديقة",
        sizes: [
          { label: "60 سم", price: "100" },
          { label: "80 سم", price: "150" },
        ],
        pairs: [
          { size: 0, colour: null, available: true },
          { size: 1, colour: null, available: true },
        ],
      });
      const first = await saveProductInDb(tx, data);
      if (first.kind !== "saved") throw new Error(first.kind);
      expect(await keysOf(tx, data.id)).toEqual({
        searchText: buildSearchText("إنارةُ حديقة", data.code, []),
        options: [
          { sizeLabel: "60 سم", sizeKey: "60سم" },
          { sizeLabel: "80 سم", sizeKey: "80سم" },
        ],
      });

      const renamed = await saveProductInDb(tx, {
        ...data,
        version: first.version,
        name: "ثريا كريستال",
        sizes: data.sizes.map((size, i) => ({
          ...size,
          originalLabel: size.label,
          label: i === 0 ? "70 سم" : size.label,
        })),
      });
      expect(renamed.kind).toBe("saved");
      const keys = await keysOf(tx, data.id);
      expect(keys.searchText).toBe(buildSearchText("ثريا كريستال", data.code, []));
      expect(keys.options.map((option) => option.sizeKey)).toEqual(["70سم", "80سم"]);
    });
  });

  it("hold a live option code inserted directly, and drop it once archived", async () => {
    await withRollback(db, async (tx) => {
      const data = editorInput({ name: "لمبه" });
      expect((await saveProductInDb(tx, data)).kind).toBe("saved");
      const optionCode = `${data.code}-GD`.toUpperCase();
      await tx
        .update(productVariants)
        .set({ code: optionCode })
        .where(eq(productVariants.productId, data.id));
      await refreshSearchKeys(tx, data.id);
      expect((await keysOf(tx, data.id)).searchText).toBe(
        buildSearchText("لمبه", data.code, [optionCode]),
      );

      await tx
        .update(productVariants)
        .set({ archivedAt: sql`now()` })
        .where(eq(productVariants.productId, data.id));
      await refreshSearchKeys(tx, data.id);
      expect((await keysOf(tx, data.id)).searchText).toBe(buildSearchText("لمبه", data.code, []));
    });
  });

  it("are written by the spreadsheet import", async () => {
    await withRollback(db, async (tx) => {
      const t = tag().toUpperCase();
      const outcome = await importProductInDb(tx, {
        code: `TSI-${t}`,
        rows: [2],
        name: "أباجورة مستوردة",
        mainCategory: `فئة ${t}`,
        specs: [],
        sizes: [{ label: "صغير جدا", price: "50" }],
        colours: [],
      });
      if (outcome.outcome === "skipped") throw new Error(outcome.problem);
      expect(await keysOf(tx, outcome.id)).toEqual({
        searchText: buildSearchText("أباجورة مستوردة", `TSI-${t}`, []),
        options: [{ sizeLabel: "صغير جدا", sizeKey: "صغيرجدا" }],
      });
    });
  });

  it("are repaired by the backfill, which then changes nothing", async () => {
    await withRollback(db, async (tx) => {
      const category = await shownCategory(tx);
      const row = await product(tx, { name: "ثريا للباكفل", categoryId: category.id });
      await tx.update(products).set({ searchText: "stale" }).where(eq(products.id, row.id));
      await tx
        .update(productVariants)
        .set({ sizeKey: "stale" })
        .where(eq(productVariants.productId, row.id));

      const first = await backfillSearchKeys(tx, 50);
      expect(first.products).toBeGreaterThanOrEqual(1);
      expect((await keysOf(tx, row.id)).searchText).toBe(
        buildSearchText("ثريا للباكفل", row.code, []),
      );
      expect((await keysOf(tx, row.id)).options).toEqual([{ sizeLabel: null, sizeKey: null }]);
      expect(await backfillSearchKeys(tx, 50)).toEqual({ products: 0, options: 0 });
    });
  });
});

describe.skipIf(!hasLocalDb)("a search list", () => {
  it("matches every word in any order, with Arabic spelling folded", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const category = await shownCategory(tx);
      const garden = await product(tx, { name: `إنارة حديقة ${t}`, categoryId: category.id });
      await product(tx, { name: `إنارة داخلية ${t}`, categoryId: category.id });

      expect(await searchCodes(tx, `انارة ${t}`)).toHaveLength(2);
      expect(await searchCodes(tx, `${t} حديقه انارة`)).toEqual([garden.code]);
      expect(await searchCodes(tx, `${t} غرفة`)).toEqual([]);
    });
  });

  it("never finds hidden, archived, or not shown products, or an archived option's code", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const shown = await shownCategory(tx);
      const hiddenMain = await shownCategory(tx, { isVisible: false });
      const subOfHidden = await shownCategory(tx, { parentId: hiddenMain.id });
      const listed = await product(tx, { name: `ثريا ${t}`, categoryId: shown.id });
      await product(tx, { name: `ثريا ${t}`, categoryId: shown.id, status: "hidden" });
      await product(tx, { name: `ثريا ${t}`, categoryId: shown.id, status: "archived" });
      await product(tx, { name: `ثريا ${t}`, categoryId: hiddenMain.id });
      await product(tx, { name: `ثريا ${t}`, categoryId: subOfHidden.id });
      await product(tx, {
        name: "لمبه",
        categoryId: shown.id,
        options: [{ code: `${t}-OLD`.toUpperCase(), archivedAt: new Date() }],
      });

      expect(await searchCodes(tx, `ثريا ${t}`)).toEqual([listed.code]);
      expect(await searchCodes(tx, `${t}-old`)).toEqual([]);
    });
  });

  it("takes %, _, and the backslash literally", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const category = await shownCategory(tx);
      const percent = await product(tx, { name: `لمبه 50% ${t}`, categoryId: category.id });
      await product(tx, { name: `لمبه 500 ${t}`, categoryId: category.id });
      const under = await product(tx, { name: `لمبه a_b ${t}`, categoryId: category.id });
      await product(tx, { name: `لمبه axb ${t}`, categoryId: category.id });
      const slash = await product(tx, { name: String.raw`لمبه c\d ${t}`, categoryId: category.id });
      await product(tx, { name: `لمبه cd ${t}`, categoryId: category.id });

      expect(await searchCodes(tx, `50% ${t}`)).toEqual([percent.code]);
      expect(await searchCodes(tx, `a_b ${t}`)).toEqual([under.code]);
      expect(await searchCodes(tx, String.raw`c\d ${t}`)).toEqual([slash.code]);
    });
  });

  it("orders tiers 0 to 3 ahead of newest first, matching the tier in code", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const query = `${t}-1`;
      const category = await shownCategory(tx);
      const day = (n: number) => new Date(Date.UTC(2026, 0, n));
      // Oldest first, so newest first alone would give the reverse order.
      const exact = await product(tx, {
        name: "لمبه",
        code: query.toUpperCase(),
        categoryId: category.id,
        createdAt: day(1),
      });
      const prefix = await product(tx, {
        name: "لمبه",
        code: `${query}0`.toUpperCase(),
        categoryId: category.id,
        createdAt: day(2),
      });
      const startsText = await product(tx, {
        name: `${query} لمبه`,
        categoryId: category.id,
        createdAt: day(3),
      });
      const inside = await product(tx, {
        name: `لمبه ${query}x`,
        categoryId: category.id,
        createdAt: day(4),
      });
      const byOption = await product(tx, {
        name: "لمبه",
        categoryId: category.id,
        createdAt: day(5),
        options: [{ code: `${t}-OPT`.toUpperCase() }],
      });

      expect(await searchCodes(tx, query)).toEqual([
        exact.code,
        prefix.code,
        startsText.code,
        inside.code,
      ]);
      expect(await searchCodes(tx, `${t}-opt`)).toEqual([byOption.code]);

      const stored = await tx
        .select({ id: products.id, code: products.code, searchText: products.searchText })
        .from(products)
        .where(and(sql`${products.searchText} like ${`%${t}%`}`));
      const tiers = new Map(
        stored.map((row) => [row.code, searchTier({ ...row, optionCodes: [] }, terms(query))]),
      );
      expect([exact, prefix, startsText, inside].map((row) => tiers.get(row.code))).toEqual([
        0, 1, 2, 3,
      ]);
    });
  });

  it("clamps the page to the last one before reading", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const category = await shownCategory(tx);
      await product(tx, { name: `لمبه ${t}`, categoryId: category.id });
      const page = await searchList(tx, `لمبه ${t}`, 9);
      expect(page).toMatchObject({ total: 1, page: 1 });
      expect(page.products).toHaveLength(1);
    });
  });
});
