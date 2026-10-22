import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { categories, products } from "@/server/db/schema";
import { hasLocalDb, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const {
  createCategoryInDb,
  deleteCategoryInDb,
  findOrCreateTopCategory,
  moveCategoryInDb,
  readAdminCategories,
  updateCategoryInDb,
} = await import("./categories");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// covers: AC-1, AC-2, AC-3, AC-4, AC-4a, AC-5, AC-6 (spec 0008)

// Names unique to this run, so the shop's own categories never clash with the test.
const tag = () => crypto.randomUUID().slice(0, 6);

const visible = { isVisible: true } as const;

async function created(tx: Transaction, name: string, parentId?: string) {
  const outcome = await createCategoryInDb(tx, { name, parentId, ...visible });
  if (outcome.kind !== "created") throw new Error(`expected created, got ${outcome.kind}`);
  const [row] = await tx.select().from(categories).where(eq(categories.id, outcome.id));
  return row;
}

async function addProduct(
  tx: Transaction,
  categoryId: string,
  status: "active" | "hidden" | "archived" = "active",
) {
  const code = `CAT-${tag().toUpperCase()}`;
  await tx
    .insert(products)
    .values({ categoryId, code, name: `منتج ${code}`, slug: `cat-${code}`, status });
}

describe.skipIf(!hasLocalDb)("createCategoryInDb", () => {
  it("adds a main and a sub, each last among its siblings, with a slug from the name", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const main = await created(tx, `ثريات ${t}`);
      expect(main).toMatchObject({ parentId: null, slug: `ثريات-${t}`, isVisible: true });

      const first = await created(tx, `كريستال ${t}`, main.id);
      const second = await created(tx, `مودرن ${t}`, main.id);
      expect([first.sort, second.sort]).toEqual([0, 1]);
      expect(second.parentId).toBe(main.id);

      const another = await created(tx, `أباجورات ${t}`);
      expect(another.sort).toBeGreaterThan(main.sort);
    });
  });

  it("adds -2 on a slug clash, and qism when the name gives no slug", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const main = await created(tx, `LED ${t}`);
      const sub = await created(tx, `LED ${t}`, main.id);
      expect(main.slug).toBe(`led-${t}`);
      expect(sub.slug).toBe(`led-${t}-2`);

      const symbols = await created(tx, "★★");
      expect(symbols.slug).toMatch(/^qism(-\d+)?$/);
    });
  });

  it("refuses a sibling name in any case, a parent that is a sub, and a missing parent", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const main = await created(tx, `led ${t}`);
      expect(await createCategoryInDb(tx, { name: `LED ${t}`, ...visible })).toEqual({
        kind: "name_taken",
      });
      // The same name under a main is a different level, so it is fine.
      const sub = await created(tx, `LED ${t}`, main.id);

      expect(await createCategoryInDb(tx, { name: "عميق", parentId: sub.id, ...visible })).toEqual({
        kind: "too_deep",
      });
      expect(
        await createCategoryInDb(tx, {
          name: "يتيم",
          parentId: crypto.randomUUID(),
          ...visible,
        }),
      ).toEqual({ kind: "not_found" });
    });
  });

  it("is the insert the import's find or create uses, matching names in any case", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const main = await created(tx, `Spot ${t}`);
      expect(await findOrCreateTopCategory(tx, `SPOT ${t}`)).toBe(main.id);
      const made = await findOrCreateTopCategory(tx, `★ ${t}`);
      const [row] = await tx.select().from(categories).where(eq(categories.id, made));
      expect(row.sort).toBeGreaterThan(main.sort);
    });
  });
});

describe.skipIf(!hasLocalDb)("updateCategoryInDb", () => {
  it("changes only the name, description, and visibility", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const main = await created(tx, `قديم ${t}`);
      expect(
        await updateCategoryInDb(tx, {
          id: main.id,
          name: `جديد ${t}`,
          description: "وصف",
          isVisible: false,
        }),
      ).toEqual({ kind: "updated", id: main.id });
      const [row] = await tx.select().from(categories).where(eq(categories.id, main.id));
      expect(row).toMatchObject({
        name: `جديد ${t}`,
        description: "وصف",
        isVisible: false,
        slug: main.slug,
        sort: main.sort,
        parentId: null,
      });
    });
  });

  it("refuses a sibling's name but keeps its own in another case", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const a = await created(tx, `أ ${t}`);
      await created(tx, `ب ${t}`);
      expect(await updateCategoryInDb(tx, { id: a.id, name: `ب ${t}`, ...visible })).toEqual({
        kind: "name_taken",
      });
      expect(await updateCategoryInDb(tx, { id: a.id, name: `أ ${t}`, ...visible })).toMatchObject({
        kind: "updated",
      });
      expect(
        await updateCategoryInDb(tx, { id: crypto.randomUUID(), name: "س", ...visible }),
      ).toEqual({ kind: "not_found" });
    });
  });

  it("hides a main without writing its subs' flags", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const main = await created(tx, `رئيسي ${t}`);
      const shownSub = await created(tx, `ظاهر ${t}`, main.id);
      const hiddenSub = await created(tx, `مخفي ${t}`, main.id);
      await updateCategoryInDb(tx, { id: hiddenSub.id, name: hiddenSub.name, isVisible: false });

      await updateCategoryInDb(tx, { id: main.id, name: main.name, isVisible: false });
      await updateCategoryInDb(tx, { id: main.id, name: main.name, isVisible: true });

      const subs = await tx
        .select({ id: categories.id, isVisible: categories.isVisible })
        .from(categories)
        .where(inArray(categories.id, [shownSub.id, hiddenSub.id]));
      expect(new Map(subs.map((s) => [s.id, s.isVisible]))).toEqual(
        new Map([
          [shownSub.id, true],
          [hiddenSub.id, false],
        ]),
      );
    });
  });
});

describe.skipIf(!hasLocalDb)("moveCategoryInDb", () => {
  it("swaps two subs the import left at the same sort with one step", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const main = await created(tx, `رئيسي ${t}`);
      const [a, b] = await tx
        .insert(categories)
        .values([
          { name: "أ", slug: `imp-a-${t}`, parentId: main.id, sort: 0 },
          { name: "ب", slug: `imp-b-${t}`, parentId: main.id, sort: 0 },
        ])
        .returning();

      expect(await moveCategoryInDb(tx, a.id, "down")).toEqual({ kind: "moved", id: a.id });
      const order = await tx
        .select({ id: categories.id, sort: categories.sort })
        .from(categories)
        .where(eq(categories.parentId, main.id))
        .orderBy(categories.sort, categories.name, categories.id);
      expect(order).toEqual([
        { id: b.id, sort: 0 },
        { id: a.id, sort: 1 },
      ]);

      expect(await moveCategoryInDb(tx, a.id, "down")).toEqual({ kind: "at_edge" });
      expect(await moveCategoryInDb(tx, crypto.randomUUID(), "up")).toEqual({
        kind: "not_found",
      });
    });
  });
});

describe.skipIf(!hasLocalDb)("deleteCategoryInDb", () => {
  it("refuses a category with an archived product, and a main with a sub", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const withArchived = await created(tx, `مؤرشف ${t}`);
      await addProduct(tx, withArchived.id, "archived");
      expect(await deleteCategoryInDb(tx, withArchived.id)).toEqual({ kind: "not_empty" });

      const parent = await created(tx, `أب ${t}`);
      const child = await created(tx, `ابن ${t}`, parent.id);
      expect(await deleteCategoryInDb(tx, parent.id)).toEqual({ kind: "not_empty" });

      expect(await deleteCategoryInDb(tx, child.id)).toEqual({ kind: "deleted", id: child.id });
      expect(await deleteCategoryInDb(tx, parent.id)).toEqual({ kind: "deleted", id: parent.id });
      expect(await deleteCategoryInDb(tx, parent.id)).toEqual({ kind: "not_found" });
    });
  });
});

describe.skipIf(!hasLocalDb)("readAdminCategories", () => {
  it("counts products not archived, a main adding its subs, and knows what can be deleted", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const main = await created(tx, `عدّ ${t}`);
      const sub = await created(tx, `فرعي ${t}`, main.id);
      const empty = await created(tx, `فارغ ${t}`, main.id);
      await addProduct(tx, main.id);
      await addProduct(tx, sub.id, "hidden");
      await addProduct(tx, sub.id, "archived");

      const tree = await readAdminCategories(tx);
      const found = tree.find((row) => row.id === main.id);
      expect(found).toMatchObject({ productCount: 2, canDelete: false });
      expect(found?.subs).toEqual([
        {
          id: sub.id,
          name: sub.name,
          description: null,
          isVisible: true,
          productCount: 1,
          canDelete: false,
        },
        {
          id: empty.id,
          name: empty.name,
          description: null,
          isVisible: true,
          productCount: 0,
          canDelete: true,
        },
      ]);
    });
  });
});
