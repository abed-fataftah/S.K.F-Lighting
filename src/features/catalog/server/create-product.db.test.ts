import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { categories, products, productVariants } from "@/server/db/schema";
import { hasLocalDb, withRollback } from "@/server/db/testing";
import { productFormSchema } from "../schemas";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { createProductInDb } = await import("./create-product");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

const input = (fields: Record<string, string>) =>
  productFormSchema.parse({ name: "ثريا اختبار", price: "125.50", ...fields });

// covers: AC-2 (spec 0004)
describe.skipIf(!hasLocalDb)("createProductInDb on the local database", () => {
  it("saves an active product with one default variant in a new top level category", async () => {
    await withRollback(db, async (tx) => {
      const outcome = await createProductInDb(
        tx,
        input({ code: " tcp-1 ", newCategoryName: "فئة اختبار جديدة" }),
      );
      expect(outcome).toMatchObject({ kind: "created", slug: "ثريا-اختبار-TCP-1" });
      if (outcome.kind !== "created") return;

      const [product] = await tx.select().from(products).where(eq(products.id, outcome.productId));
      expect(product).toMatchObject({ code: "TCP-1", status: "active", isAvailable: true });
      const variants = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, outcome.productId));
      expect(variants).toMatchObject([
        { price: 12_550, isDefault: true, sizeLabel: null, colourId: null, isAvailable: true },
      ]);
      const [category] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, product.categoryId));
      expect(category).toMatchObject({
        name: "فئة اختبار جديدة",
        slug: "فئة-اختبار-جديدة",
        parentId: null,
        sort: 0,
        isVisible: true,
      });
    });
  });

  it("reuses a category with the typed name, and suffixes a clashing slug", async () => {
    await withRollback(db, async (tx) => {
      const [taken] = await tx
        .insert(categories)
        .values({ name: "اسم آخر", slug: "فئة-مكررة" })
        .returning();

      const first = await createProductInDb(
        tx,
        input({ code: "TCP-2", newCategoryName: "فئة مكررة" }),
      );
      const second = await createProductInDb(
        tx,
        input({ code: "TCP-3", newCategoryName: "فئة مكررة" }),
      );
      if (first.kind !== "created" || second.kind !== "created") throw new Error("not created");

      const rows = await tx
        .select({ categoryId: products.categoryId })
        .from(products)
        .where(eq(products.code, "TCP-2"))
        .union(
          tx
            .select({ categoryId: products.categoryId })
            .from(products)
            .where(eq(products.code, "TCP-3")),
        );
      expect(rows).toHaveLength(1);
      const [made] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, rows[0].categoryId));
      expect(made.slug).toBe("فئة-مكررة-2");
      expect(made.id).not.toBe(taken.id);
    });
  });

  it("uses the chosen category when no new name is typed", async () => {
    await withRollback(db, async (tx) => {
      const [category] = await tx
        .insert(categories)
        .values({ name: "مختارة", slug: "test-chosen" })
        .returning();
      const outcome = await createProductInDb(
        tx,
        input({ code: "TCP-4", categoryId: category.id }),
      );
      expect(outcome.kind).toBe("created");
    });
  });

  it("refuses a code that is taken and a category that does not exist, saving nothing", async () => {
    await withRollback(db, async (tx) => {
      await createProductInDb(tx, input({ code: "TCP-5", newCategoryName: "فئة أولى" }));
      const before = await tx.select().from(categories);

      expect(
        await createProductInDb(tx, input({ code: "tcp-5", newCategoryName: "فئة لن تُحفظ" })),
      ).toEqual({ kind: "code_taken" });
      expect(
        await createProductInDb(
          tx,
          input({ code: "TCP-6", categoryId: "00000000-0000-4000-8000-000000000000" }),
        ),
      ).toEqual({ kind: "category_missing" });
      expect(await tx.select().from(categories)).toHaveLength(before.length);
    });
  });

  it("rolls back a new category when the product slug clashes", async () => {
    await withRollback(db, async (tx) => {
      // name "سلك" + code "1-A" and name "سلك 1" + code "A" make the same slug.
      await createProductInDb(tx, input({ name: "سلك", code: "1-A", newCategoryName: "فئة أ" }));
      const before = await tx.select().from(categories);

      expect(
        await createProductInDb(
          tx,
          input({ name: "سلك 1", code: "A", newCategoryName: "فئة جديدة ب" }),
        ),
      ).toEqual({ kind: "slug_taken" });
      expect(await tx.select().from(categories)).toHaveLength(before.length);
    });
  });
});
