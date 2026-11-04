import { and, asc, eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  categories,
  colours,
  draftLines,
  drafts,
  products,
  productVariants,
  profiles,
} from "@/server/db/schema";
import { hasLocalDb } from "@/server/db/testing";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { createDraftInDb } = await import("./drafts-db");
const { updateDraftLineInDb } = await import("./lines-db");
const { addToDraftInDb, readDraftPickerData } = await import("./add-from-catalog");

// covers: AC-4, AC-7, AC-8, AC-9, AC-15 (spec 0021)

const db = hasLocalDb ? getDirectDb() : (null as never);
const PREFIX = "ATD-TEST";
const MISSING = "6f1c2c8e-4d7a-4a5b-9a51-2f0e5d3c1b7a";

let owner = "";
let other = "";
let category = "";
let productA = "";
let productB = "";
/** Product A's options: 60 gold, 60 black, 40 gold (unavailable), 80 gold (archived). */
let a60g = "";
let a60b = "";
let a40g = "";
let a80g = "";
let optionB = "";

async function insertUser(email: string) {
  const [user] = await db.execute<{ id: string }>(sql`
    insert into auth.users (id, aud, role, email)
    values (gen_random_uuid(), 'authenticated', 'authenticated', ${email})
    returning id`);
  await db.update(profiles).set({ role: "electrician" }).where(eq(profiles.id, user.id));
  return user.id;
}

async function cleanUp() {
  // Drafts go with their profiles by cascade.
  await db.execute(sql`delete from auth.users where email like 'atd-test-%@example.test'`);
  await db.delete(products).where(like(products.code, `${PREFIX}%`));
  await db.delete(colours).where(like(colours.name, "لون atd%"));
  await db.delete(categories).where(like(categories.slug, "atd-test%"));
}

const newDraft = async (name = "ali / mo", user = owner) => {
  const outcome = await createDraftInDb(db, user, name);
  if (outcome.kind !== "created") throw new Error(`createDraft: ${outcome.kind}`);
  return outcome.draftId;
};

const linesOf = (draftId: string) =>
  db
    .select({
      productId: draftLines.productId,
      variantId: draftLines.variantId,
      quantity: draftLines.quantity,
      sort: draftLines.sort,
    })
    .from(draftLines)
    .where(eq(draftLines.draftId, draftId))
    .orderBy(asc(draftLines.sort), asc(draftLines.createdAt), asc(draftLines.id));

const add = (
  draftId: string,
  variantId: string,
  quantity: number,
  productId = productA,
  user = owner,
) => addToDraftInDb(db, user, { productId, variantId, quantity, target: { draftId } });

const addNew = (newDraftName: string, variantId = a60g, quantity = 1) =>
  addToDraftInDb(db, owner, { productId: productA, variantId, quantity, target: { newDraftName } });

describe.skipIf(!hasLocalDb)("add to draft from the catalog on the local database", () => {
  beforeAll(async () => {
    await cleanUp();
    owner = await insertUser("atd-test-owner@example.test");
    other = await insertUser("atd-test-other@example.test");
    const [made] = await db
      .insert(categories)
      .values({ name: "فئة اختبار الإضافة", slug: "atd-test" })
      .returning();
    category = made.id;
    const [gold, black] = await db
      .insert(colours)
      .values([{ name: "لون atd ذهبي" }, { name: "لون atd أسود" }])
      .returning();
    const [a, b] = await db
      .insert(products)
      .values([
        { categoryId: category, code: `${PREFIX}-A`, name: "ثريا إضافة", slug: "atd-test-a" },
        { categoryId: category, code: `${PREFIX}-B`, name: "سبوت إضافة", slug: "atd-test-b" },
      ])
      .returning();
    productA = a.id;
    productB = b.id;
    const variants = await db
      .insert(productVariants)
      .values([
        { productId: a.id, sizeLabel: "60 سم", colourId: gold.id, price: 10_000, sort: 0 },
        { productId: a.id, sizeLabel: "60 سم", colourId: black.id, price: 11_000, sort: 1 },
        { productId: a.id, sizeLabel: "40 سم", colourId: gold.id, price: 8_000, sort: 2 },
        { productId: a.id, sizeLabel: "80 سم", colourId: gold.id, price: 15_000, sort: 3 },
        { productId: b.id, price: 1_500, isDefault: true },
      ])
      .returning();
    [a60g, a60b, a40g, a80g, optionB] = variants.map((v) => v.id);
  });

  beforeEach(async () => {
    await db.delete(drafts).where(inArray(drafts.ownerUserId, [owner, other]));
    await db
      .update(products)
      .set({ status: "active", isAvailable: true })
      .where(inArray(products.id, [productA, productB]));
    await db.update(categories).set({ isVisible: true }).where(eq(categories.id, category));
    await db
      .update(productVariants)
      .set({ isAvailable: true, archivedAt: null })
      .where(inArray(productVariants.id, [a60g, a60b, a80g, optionB]));
    await db
      .update(productVariants)
      .set({ isAvailable: false })
      .where(eq(productVariants.id, a40g));
    await db
      .update(productVariants)
      .set({ archivedAt: new Date() })
      .where(eq(productVariants.id, a80g));
  });

  afterAll(async () => {
    if (!hasLocalDb) return;
    await cleanUp();
    await db.$client.end();
  });

  describe("readDraftPickerData", () => {
    it("lists the drafts newest first with line counts, and the product's live options", async () => {
      const older = await newDraft("older");
      const newer = await newDraft("newer");
      await add(older, a60g, 1);
      // The add bumped `older`, so it is now the newest.
      const data = await readDraftPickerData(db, owner, productA);
      expect(data.drafts).toEqual([
        { id: older, name: "older", lineCount: 2 },
        { id: newer, name: "newer", lineCount: 1 },
      ]);
      expect(data.draftLimitReached).toBe(false);
      expect(data.product?.options.map((o) => [o.id, o.sellable])).toEqual([
        [a60g, true],
        [a60b, true],
        [a40g, false],
      ]);
      expect(data.product).toMatchObject({ id: productA, code: `${PREFIX}-A`, sellable: true });
    });

    it("gives no product when it is hidden or its category is not shown", async () => {
      await db.update(products).set({ status: "hidden" }).where(eq(products.id, productA));
      expect((await readDraftPickerData(db, owner, productA)).product).toBeNull();
      await db.update(products).set({ status: "active" }).where(eq(products.id, productA));
      await db.update(categories).set({ isVisible: false }).where(eq(categories.id, category));
      expect((await readDraftPickerData(db, owner, productA)).product).toBeNull();
    });

    it("never lists another user's drafts", async () => {
      await newDraft("theirs", other);
      expect((await readDraftPickerData(db, owner, productA)).drafts).toEqual([]);
    });
  });

  describe("into an existing draft", () => {
    it("appends past the highest sort and bumps updated_at", async () => {
      const draftId = await newDraft();
      const [before] = await db.select().from(drafts).where(eq(drafts.id, draftId));
      expect(await add(draftId, a60g, 2)).toEqual({
        kind: "added",
        draftId,
        draftName: "ali / mo",
        position: 2,
        quantity: 2,
        merged: false,
        newDraft: false,
      });
      expect(await linesOf(draftId)).toEqual([
        { productId: null, variantId: null, quantity: null, sort: 0 },
        { productId: productA, variantId: a60g, quantity: 2, sort: 1 },
      ]);
      const [after] = await db.select().from(drafts).where(eq(drafts.id, draftId));
      expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    });

    it("merges into the option's line, and refuses past 999 changing nothing", async () => {
      const draftId = await newDraft();
      await add(draftId, a60g, 990);
      expect(await add(draftId, a60g, 9)).toMatchObject({
        kind: "added",
        position: 2,
        quantity: 999,
        merged: true,
      });
      expect(await add(draftId, a60g, 1)).toEqual({
        kind: "quantity_over",
        position: 2,
        current: 999,
      });
      expect((await linesOf(draftId)).map((line) => line.quantity)).toEqual([null, 999]);
    });

    it("merges into a line whose quantity is still empty", async () => {
      const draftId = await newDraft();
      const [row] = await db.select().from(draftLines).where(eq(draftLines.draftId, draftId));
      await updateDraftLineInDb(db, owner, {
        lineId: row.id,
        productId: productA,
        variantId: a60b,
      });
      expect(row.quantity).toBeNull();
      expect(await add(draftId, a60b, 4)).toMatchObject({ position: 1, quantity: 4, merged: true });
    });

    it("leaves a product only line alone and appends a new one", async () => {
      const draftId = await newDraft();
      const [row] = await db.select().from(draftLines).where(eq(draftLines.draftId, draftId));
      await updateDraftLineInDb(db, owner, {
        lineId: row.id,
        productId: productA,
        variantId: null,
      });
      expect(await add(draftId, a60g, 1)).toMatchObject({ position: 2, merged: false });
      expect((await linesOf(draftId)).map((line) => line.variantId)).toEqual([null, a60g]);
    });

    it("refuses a 31st line but still merges into a full draft", async () => {
      const draftId = await newDraft();
      await add(draftId, a60g, 1);
      await db
        .insert(draftLines)
        .values(Array.from({ length: 28 }, (_, i) => ({ draftId, sort: i + 2 })));
      expect(await add(draftId, a60b, 1)).toEqual({ kind: "too_many_lines" });
      expect(await add(draftId, a60g, 1)).toMatchObject({ position: 2, quantity: 2, merged: true });
      expect(await linesOf(draftId)).toHaveLength(30);
    });

    it("refuses an option that cannot be sold, or a product that is not listed", async () => {
      const draftId = await newDraft();
      expect(await add(draftId, a40g, 1)).toEqual({ kind: "not_sellable" });
      await db.update(products).set({ isAvailable: false }).where(eq(products.id, productA));
      expect(await add(draftId, a60g, 1)).toEqual({ kind: "not_sellable" });
      await db
        .update(products)
        .set({ isAvailable: true, status: "hidden" })
        .where(eq(products.id, productA));
      expect(await add(draftId, a60g, 1)).toEqual({ kind: "not_sellable" });
      await db.update(products).set({ status: "active" }).where(eq(products.id, productA));
      await db.update(categories).set({ isVisible: false }).where(eq(categories.id, category));
      expect(await add(draftId, a60g, 1)).toEqual({ kind: "not_sellable" });
      expect(await linesOf(draftId)).toHaveLength(1);
    });

    it("refuses an archived option or one from another product as invalid", async () => {
      const draftId = await newDraft();
      expect(await add(draftId, a80g, 1)).toEqual({ kind: "invalid" });
      expect(await add(draftId, optionB, 1)).toEqual({ kind: "invalid" });
      expect(await add(draftId, a60g, 1, MISSING)).toEqual({ kind: "invalid" });
    });

    it("treats someone else's draft, or a missing one, as not found", async () => {
      const theirs = await newDraft("theirs", other);
      expect(await add(theirs, a60g, 1)).toEqual({ kind: "not_found" });
      expect(await add(MISSING, a60g, 1)).toEqual({ kind: "not_found" });
      expect(await linesOf(theirs)).toHaveLength(1);
    });

    it("ends two concurrent adds of the same option as one line with the sum", async () => {
      const draftId = await newDraft();
      const both = await Promise.all([add(draftId, a60g, 3), add(draftId, a60g, 4)]);
      expect(both.map((o) => (o.kind === "added" ? o.merged : null)).sort()).toEqual([false, true]);
      const lines = await linesOf(draftId);
      expect(lines.filter((line) => line.variantId === a60g)).toEqual([
        { productId: productA, variantId: a60g, quantity: 7, sort: 1 },
      ]);
    });
  });

  describe("into a new draft", () => {
    it("creates the draft holding exactly that line", async () => {
      const outcome = await addNew("site B", a60b, 5);
      expect(outcome).toMatchObject({
        kind: "added",
        draftName: "site B",
        position: 1,
        quantity: 5,
        merged: false,
        newDraft: true,
      });
      const draftId = outcome.kind === "added" ? outcome.draftId : "";
      expect(await linesOf(draftId)).toEqual([
        { productId: productA, variantId: a60b, quantity: 5, sort: 0 },
      ]);
    });

    it("creates nothing for a taken name or at 30 drafts", async () => {
      await newDraft("Site A");
      expect(await addNew("SITE A")).toEqual({ kind: "name_taken" });
      for (let i = 2; i <= 30; i += 1) await newDraft(`draft ${i}`);
      expect(await addNew("one more")).toEqual({ kind: "too_many_drafts" });
      const mine = await db.select().from(drafts).where(eq(drafts.ownerUserId, owner));
      expect(mine).toHaveLength(30);
      expect((await readDraftPickerData(db, owner, productA)).draftLimitReached).toBe(true);
    });

    it("creates nothing when the option cannot be sold", async () => {
      expect(await addNew("site c", a40g)).toEqual({ kind: "not_sellable" });
      const mine = await db
        .select()
        .from(drafts)
        .where(and(eq(drafts.ownerUserId, owner), eq(drafts.name, "site c")));
      expect(mine).toEqual([]);
    });
  });
});
