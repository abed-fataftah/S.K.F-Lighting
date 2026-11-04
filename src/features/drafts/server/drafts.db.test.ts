import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  categories,
  colours,
  deliveryZones,
  draftLines,
  drafts,
  orderEvents,
  orderLines,
  orderNumberCounters,
  orders,
  products,
  productVariants,
  profiles,
} from "@/server/db/schema";
import { hasLocalDb } from "@/server/db/testing";
import { refreshSearchKeys } from "@/features/catalog/server/search-keys";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { createDraftInDb, renameDraftInDb, deleteDraftInDb, saveDraftCustomerInDb } =
  await import("./drafts-db");
const { addDraftLineInDb, updateDraftLineInDb, removeDraftLineInDb, restoreDraftLineInDb } =
  await import("./lines-db");
const { readDraft, readMyDrafts } = await import("./read-draft");
const { searchQuickOrderProducts } = await import("./search");
const { sendDraftInDb } = await import("./send");
const { deleteProductInDb } = await import("@/features/catalog/server/product-lifecycle");

// covers: AC-3, AC-4, AC-5, AC-7, AC-8, AC-9, AC-10, AC-11, AC-13, AC-14, AC-15, AC-17, AC-18 (spec 0020)

const db = hasLocalDb ? getDirectDb() : (null as never);
const YEAR = 2093;
const placedAt = new Date(`${YEAR}-03-01T09:00:00Z`);
const PREFIX = "DRF-TEST";

let owner = "";
let other = "";
let productA = "";
let productB = "";
let optionsA: { id: string; sizeLabel: string | null; colourName: string | null }[] = [];
let optionB = "";
let zone = { id: "", fee: 0 };

async function insertUser(email: string) {
  const [user] = await db.execute<{ id: string }>(sql`
    insert into auth.users (id, aud, role, email)
    values (gen_random_uuid(), 'authenticated', 'authenticated', ${email})
    returning id`);
  await db
    .update(profiles)
    .set({ role: "electrician", fullName: "كهربائي اختبار" })
    .where(eq(profiles.id, user.id));
  return user.id;
}

async function cleanUp() {
  const placed = await db
    .select({ id: orders.id })
    .from(orders)
    .where(like(orders.orderNumber, `${String(YEAR).slice(2)}-%`));
  const ids = placed.map((order) => order.id);
  if (ids.length) {
    await db.delete(orderEvents).where(inArray(orderEvents.orderId, ids));
    await db.delete(orderLines).where(inArray(orderLines.orderId, ids));
    await db.delete(orders).where(inArray(orders.id, ids));
  }
  await db.delete(orderNumberCounters).where(eq(orderNumberCounters.year, YEAR));
  // Drafts go with their profiles by cascade.
  await db.execute(sql`delete from auth.users where email like 'drf-test-%@example.test'`);
  await db.delete(products).where(like(products.code, `${PREFIX}%`));
  await db.delete(colours).where(like(colours.name, "لون drf%"));
  await db.delete(categories).where(like(categories.slug, "drf-test%"));
}

const newDraft = async (name = "ali / mo", user = owner) => {
  const outcome = await createDraftInDb(db, user, name);
  if (outcome.kind !== "created") throw new Error(`createDraft: ${outcome.kind}`);
  const [line] = await db.select().from(draftLines).where(eq(draftLines.draftId, outcome.draftId));
  return { draftId: outcome.draftId, lineId: line.id };
};

const okLine = <T extends { kind: string }>(outcome: T) => {
  if (outcome.kind !== "ok") throw new Error(`line: ${outcome.kind}`);
  return (outcome as unknown as { line: { id: string } }).line;
};

describe.skipIf(!hasLocalDb)("drafts on the local database", () => {
  beforeAll(async () => {
    await cleanUp();
    owner = await insertUser("drf-test-owner@example.test");
    other = await insertUser("drf-test-other@example.test");
    const [category] = await db
      .insert(categories)
      .values({ name: "فئة اختبار المسودات", slug: "drf-test" })
      .returning();
    const [gold, black] = await db
      .insert(colours)
      .values([{ name: "لون drf ذهبي" }, { name: "لون drf أسود" }])
      .returning();
    const [a, b] = await db
      .insert(products)
      .values([
        { categoryId: category.id, code: `${PREFIX}-A`, name: "ثريا مسودة", slug: "drf-test-a" },
        { categoryId: category.id, code: `${PREFIX}-B`, name: "سبوت مسودة", slug: "drf-test-b" },
      ])
      .returning();
    productA = a.id;
    productB = b.id;
    const madeA = await db
      .insert(productVariants)
      .values([
        {
          productId: a.id,
          sizeLabel: "60 سم",
          colourId: gold.id,
          price: 10_000,
          code: `${PREFIX}-A60G`,
          isDefault: true,
          sort: 0,
        },
        {
          productId: a.id,
          sizeLabel: "60 سم",
          colourId: black.id,
          price: 10_000,
          code: `${PREFIX}-A60B`,
          sort: 1,
        },
        {
          productId: a.id,
          sizeLabel: "40 سم",
          colourId: gold.id,
          price: 8_000,
          code: `${PREFIX}-A40G`,
          sort: 2,
        },
      ])
      .returning();
    optionsA = madeA.map((v, i) => ({
      id: v.id,
      sizeLabel: v.sizeLabel,
      colourName: i === 1 ? black.name : gold.name,
    }));
    const [madeB] = await db
      .insert(productVariants)
      .values({ productId: b.id, price: 1_500, isDefault: true })
      .returning();
    optionB = madeB.id;
    await refreshSearchKeys(db as never, a.id);
    await refreshSearchKeys(db as never, b.id);
    const [first] = await db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true));
    zone = { id: first.id, fee: first.fee };
  });

  beforeEach(async () => {
    await db.delete(drafts).where(inArray(drafts.ownerUserId, [owner, other]));
    await db
      .update(products)
      .set({ status: "active", isAvailable: true })
      .where(inArray(products.id, [productA, productB]));
    await db
      .update(productVariants)
      .set({ price: 1_500, isAvailable: true })
      .where(eq(productVariants.id, optionB));
  });

  afterAll(async () => {
    if (!hasLocalDb) return;
    await cleanUp();
    await db.$client.end();
  });

  describe("createDraftInDb", () => {
    it("creates a draft with one empty line", async () => {
      const { draftId } = await newDraft();
      const page = await readDraft(db, owner, draftId);
      expect(page?.name).toBe("ali / mo");
      expect(page?.lines).toHaveLength(1);
      expect(page?.lines[0]).toMatchObject({ product: null, option: null, quantity: null });
    });

    it("refuses a name another draft has, Latin letters in any case", async () => {
      await newDraft("Ali / Mo");
      expect(await createDraftInDb(db, owner, "ALI / MO")).toEqual({ kind: "name_taken" });
      // Another electrician may use the same name.
      expect((await createDraftInDb(db, other, "ali / mo")).kind).toBe("created");
    });

    it("stops at 30 drafts, also under two concurrent creates", async () => {
      for (let i = 1; i <= 29; i += 1) await newDraft(`draft ${i}`);
      const both = await Promise.all([
        createDraftInDb(db, owner, "last a"),
        createDraftInDb(db, owner, "last b"),
      ]);
      expect(both.map((o) => o.kind).sort()).toEqual(["created", "too_many_drafts"]);
      expect(await readMyDrafts(db, owner)).toHaveLength(30);
    });

    it("lets one of two racing creates with the same name win", async () => {
      const both = await Promise.all([
        createDraftInDb(db, owner, "same"),
        createDraftInDb(db, owner, "SAME"),
      ]);
      expect(both.map((o) => o.kind).sort()).toEqual(["created", "name_taken"]);
    });
  });

  describe("renameDraftInDb and deleteDraftInDb", () => {
    it("renames, allows its own name in another case, and refuses a clash", async () => {
      const { draftId } = await newDraft("site a");
      await newDraft("site b");
      expect(await renameDraftInDb(db, owner, draftId, "SITE A")).toEqual({
        kind: "renamed",
        name: "SITE A",
      });
      expect(await renameDraftInDb(db, owner, draftId, "Site B")).toEqual({ kind: "name_taken" });
      expect(await renameDraftInDb(db, other, draftId, "x y")).toEqual({ kind: "not_found" });
    });

    it("deletes only the owner's draft, with its lines", async () => {
      const { draftId } = await newDraft();
      expect(await deleteDraftInDb(db, other, draftId)).toBe(false);
      expect(await deleteDraftInDb(db, owner, draftId)).toBe(true);
      expect(await db.select().from(draftLines).where(eq(draftLines.draftId, draftId))).toEqual([]);
    });
  });

  describe("line writes", () => {
    it("sets the product, then the option, then the quantity, and bumps updated_at", async () => {
      const { draftId, lineId } = await newDraft();
      const [before] = await db.select().from(drafts).where(eq(drafts.id, draftId));
      const withProduct = okLine(
        await updateDraftLineInDb(db, owner, { lineId, productId: productA, variantId: null }),
      );
      expect(withProduct).toMatchObject({ product: { id: productA }, option: null });
      okLine(await updateDraftLineInDb(db, owner, { lineId, variantId: optionsA[2].id }));
      const line = okLine(await updateDraftLineInDb(db, owner, { lineId, quantity: 3 }));
      expect(line).toMatchObject({ quantity: 3, option: { id: optionsA[2].id, price: 8_000 } });
      const [after] = await db.select().from(drafts).where(eq(drafts.id, draftId));
      expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    });

    it("changing the product clears the option and keeps the quantity", async () => {
      const { lineId } = await newDraft();
      await updateDraftLineInDb(db, owner, {
        lineId,
        productId: productA,
        variantId: optionsA[0].id,
      });
      await updateDraftLineInDb(db, owner, { lineId, quantity: 4 });
      const line = okLine(
        await updateDraftLineInDb(db, owner, { lineId, productId: productB, variantId: null }),
      );
      expect(line).toMatchObject({ product: { id: productB }, option: null, quantity: 4 });
    });

    it("refuses an option of another product, and a second line with the same option", async () => {
      const { draftId, lineId } = await newDraft();
      expect(
        await updateDraftLineInDb(db, owner, {
          lineId,
          productId: productB,
          variantId: optionsA[0].id,
        }),
      ).toEqual({ kind: "invalid" });
      await updateDraftLineInDb(db, owner, {
        lineId,
        productId: productA,
        variantId: optionsA[0].id,
      });
      const second = okLine(await addDraftLineInDb(db, owner, draftId));
      expect(
        await updateDraftLineInDb(db, owner, {
          lineId: second.id,
          productId: productA,
          variantId: optionsA[0].id,
        }),
      ).toEqual({ kind: "duplicate", position: 1 });
      // The refused line keeps what it had.
      const page = await readDraft(db, owner, draftId);
      expect(page?.lines[1].product).toBeNull();
    });

    it("answers not_found for someone else's line", async () => {
      const { lineId } = await newDraft();
      expect(await updateDraftLineInDb(db, other, { lineId, quantity: 2 })).toEqual({
        kind: "not_found",
      });
      expect(await removeDraftLineInDb(db, other, lineId)).toBe(false);
    });

    it("stops at 30 lines, also under concurrent adds", async () => {
      const { draftId } = await newDraft();
      for (let i = 2; i <= 28; i += 1) okLine(await addDraftLineInDb(db, owner, draftId));
      const three = await Promise.all([
        addDraftLineInDb(db, owner, draftId),
        addDraftLineInDb(db, owner, draftId),
        addDraftLineInDb(db, owner, draftId),
      ]);
      expect(three.map((o) => o.kind).sort()).toEqual(["ok", "ok", "too_many_lines"]);
      expect((await readDraft(db, owner, draftId))?.lines).toHaveLength(30);
    });

    it("restores a removed line in its place", async () => {
      const { draftId, lineId } = await newDraft();
      const second = okLine(await addDraftLineInDb(db, owner, draftId));
      const third = okLine(await addDraftLineInDb(db, owner, draftId));
      await updateDraftLineInDb(db, owner, {
        lineId: second.id,
        productId: productB,
        variantId: optionB,
      });
      await updateDraftLineInDb(db, owner, { lineId: second.id, quantity: 7 });
      expect(await removeDraftLineInDb(db, owner, second.id)).toBe(true);
      const restored = okLine(
        await restoreDraftLineInDb(db, owner, {
          draftId,
          productId: productB,
          variantId: optionB,
          quantity: 7,
          sort: 1,
        }),
      );
      const ids = (await readDraft(db, owner, draftId))?.lines.map((line) => line.id);
      expect(ids).toEqual([lineId, restored.id, third.id]);
    });

    it("refuses a restore whose option is already on another line", async () => {
      const { draftId, lineId } = await newDraft();
      await updateDraftLineInDb(db, owner, { lineId, productId: productB, variantId: optionB });
      expect(
        await restoreDraftLineInDb(db, owner, {
          draftId,
          productId: productB,
          variantId: optionB,
          quantity: 1,
          sort: 5,
        }),
      ).toEqual({ kind: "duplicate", position: 1 });
    });
  });

  describe("saveDraftCustomerInDb", () => {
    it("saves the fields as typed with the E.164 phone, and keeps the zone on pickup", async () => {
      const { draftId } = await newDraft();
      expect(
        await saveDraftCustomerInDb(db, owner, {
          draftId,
          customerPhone: "0599 123 456",
          fulfilment: "delivery",
          deliveryZoneId: zone.id,
        }),
      ).toBe("saved");
      await saveDraftCustomerInDb(db, owner, { draftId, fulfilment: "pickup" });
      const [row] = await db.select().from(drafts).where(eq(drafts.id, draftId));
      expect(row).toMatchObject({
        customerPhone: "0599 123 456",
        customerPhoneE164: "+970599123456",
        fulfilment: "pickup",
        deliveryZoneId: zone.id,
      });
      expect(await saveDraftCustomerInDb(db, other, { draftId, notes: "x" })).toBe("not_found");
    });
  });

  describe("readDraft", () => {
    it("reads live prices and marks a line that cannot be sold", async () => {
      const { draftId, lineId } = await newDraft();
      await updateDraftLineInDb(db, owner, { lineId, productId: productB, variantId: optionB });
      await db.update(productVariants).set({ price: 2_000 }).where(eq(productVariants.id, optionB));
      expect((await readDraft(db, owner, draftId))?.lines[0].option).toMatchObject({
        price: 2_000,
        sellable: true,
      });
      await db.update(products).set({ isAvailable: false }).where(eq(products.id, productB));
      const line = (await readDraft(db, owner, draftId))?.lines[0];
      expect(line?.product?.sellable).toBe(false);
      expect(line?.option?.sellable).toBe(false);
    });

    it("is null for another user's draft", async () => {
      const { draftId } = await newDraft();
      expect(await readDraft(db, other, draftId)).toBeNull();
    });

    it("lists drafts newest edit first with their line counts", async () => {
      const first = await newDraft("first one");
      await newDraft("second one");
      await addDraftLineInDb(db, owner, first.draftId);
      const list = await readMyDrafts(db, owner);
      expect(list.map((d) => [d.name, d.lineCount])).toEqual([
        ["first one", 2],
        ["second one", 1],
      ]);
    });
  });

  describe("searchQuickOrderProducts", () => {
    it("finds by name with options, and picks the option an exact code names", async () => {
      const byName = await searchQuickOrderProducts(db, {
        words: ["مسوده"],
        folded: "مسوده",
        code: "مسوده",
      });
      expect(byName.map((p) => p.id).sort()).toEqual([productA, productB].sort());
      const code = `${PREFIX}-A40G`;
      const [hit] = await searchQuickOrderProducts(db, {
        words: [code.toLowerCase()],
        folded: code.toLowerCase(),
        code,
      });
      expect(hit).toMatchObject({ id: productA, exactOptionId: optionsA[2].id });
      expect(hit.options).toHaveLength(3);
    });

    it("leaves out a product that is not listed", async () => {
      await db.update(products).set({ status: "hidden" }).where(eq(products.id, productB));
      const found = await searchQuickOrderProducts(db, {
        words: ["سبوت"],
        folded: "سبوت",
        code: "سبوت",
      });
      expect(found.map((p) => p.id)).not.toContain(productB);
    });

    it("returns 8 at most, in stock first, then newest", async () => {
      const [{ categoryId }] = await db
        .select({ categoryId: products.categoryId })
        .from(products)
        .where(eq(products.id, productA));
      // One at a time, so each gets its own created_at; the newest is out of stock.
      const made: string[] = [];
      for (let i = 0; i < 10; i += 1) {
        const [product] = await db
          .insert(products)
          .values({
            categoryId,
            code: `${PREFIX}-S${i}`,
            name: `مصباح بحث ${i}`,
            slug: `drf-test-s${i}`,
            isAvailable: i !== 9,
          })
          .returning({ id: products.id });
        await db.insert(productVariants).values({ productId: product.id, price: 500 });
        await refreshSearchKeys(db as never, product.id);
        made.push(product.id);
      }
      const found = await searchQuickOrderProducts(db, {
        words: ["مصباح"],
        folded: "مصباح",
        code: "مصباح",
      });
      expect(found.map((p) => p.id)).toEqual(made.slice(1, 9).reverse());
      await db.delete(products).where(inArray(products.id, made));
    });
  });

  describe("sendDraftInDb", () => {
    async function readyDraft(user = owner) {
      const { draftId, lineId } = await newDraft("send me", user);
      await updateDraftLineInDb(db, user, { lineId, productId: productB, variantId: optionB });
      await updateDraftLineInDb(db, user, { lineId, quantity: 2 });
      await saveDraftCustomerInDb(db, user, {
        draftId,
        customerName: "محمد علي",
        customerPhone: "0599123456",
        fulfilment: "pickup",
      });
      return { draftId, lineId };
    }

    it("writes the order from the draft and deletes the draft", async () => {
      const { draftId } = await readyDraft();
      const outcome = await sendDraftInDb(db, {
        userId: owner,
        draftId,
        expectedTotal: 3_000,
        placedAt,
      });
      expect(outcome).toMatchObject({ kind: "placed", lineCount: 1, total: 3_000 });
      if (outcome.kind !== "placed") return;
      const [order] = await db.select().from(orders).where(eq(orders.id, outcome.orderId));
      expect(order).toMatchObject({
        placedByUserId: owner,
        placedByRole: "electrician",
        customerName: "محمد علي",
        customerPhoneE164: "+970599123456",
        idempotencyKey: draftId,
        total: 3_000,
      });
      const [event] = await db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
      expect(event).toMatchObject({
        type: "created",
        actorKind: "electrician",
        actorUserId: owner,
      });
      expect(await db.select().from(drafts).where(eq(drafts.id, draftId))).toEqual([]);
      // A replay answers with the same order.
      expect(
        await sendDraftInDb(db, { userId: owner, draftId, expectedTotal: 3_000, placedAt }),
      ).toEqual({ kind: "replayed", orderId: order.id, orderNumber: order.orderNumber });
      // Another electrician sending the same id never sees it.
      expect(
        await sendDraftInDb(db, { userId: other, draftId, expectedTotal: 3_000, placedAt }),
      ).toEqual({ kind: "not_found" });
    });

    it("writes every line in draft order, with the delivery fee", async () => {
      const { draftId, lineId } = await newDraft("two lines");
      const second = okLine(await addDraftLineInDb(db, owner, draftId));
      await updateDraftLineInDb(db, owner, { lineId, productId: productA, variantId: null });
      await updateDraftLineInDb(db, owner, { lineId, variantId: optionsA[2].id });
      await updateDraftLineInDb(db, owner, { lineId, quantity: 1 });
      await updateDraftLineInDb(db, owner, {
        lineId: second.id,
        productId: productB,
        variantId: optionB,
      });
      await updateDraftLineInDb(db, owner, { lineId: second.id, quantity: 2 });
      await saveDraftCustomerInDb(db, owner, {
        draftId,
        customerName: "  محمد   علي ",
        customerPhone: "0599123456",
        fulfilment: "delivery",
        deliveryZoneId: zone.id,
        city: "رام الله",
        address: "شارع الإرسال، عمارة 4",
      });
      const total = 8_000 + 2 * 1_500 + zone.fee;

      const outcome = await sendDraftInDb(db, {
        userId: owner,
        draftId,
        expectedTotal: total,
        placedAt,
      });
      expect(outcome).toMatchObject({ kind: "placed", lineCount: 2, total });
      if (outcome.kind !== "placed") return;
      const [order] = await db.select().from(orders).where(eq(orders.id, outcome.orderId));
      // The order row takes the schema's tidied output, not the stored text.
      expect(order).toMatchObject({
        customerName: "محمد علي",
        fulfilment: "delivery",
        deliveryZoneId: zone.id,
        deliveryFee: zone.fee,
      });
      const written = await db
        .select({ variantId: orderLines.variantId, quantity: orderLines.quantity })
        .from(orderLines)
        .where(eq(orderLines.orderId, order.id))
        .orderBy(orderLines.sort);
      expect(written).toEqual([
        { variantId: optionsA[2].id, quantity: 1 },
        { variantId: optionB, quantity: 2 },
      ]);
    });

    it("makes one order from two concurrent sends", async () => {
      const { draftId } = await readyDraft();
      const both = await Promise.all([
        sendDraftInDb(db, { userId: owner, draftId, expectedTotal: 3_000, placedAt }),
        sendDraftInDb(db, { userId: owner, draftId, expectedTotal: 3_000, placedAt }),
      ]);
      expect(both.map((o) => o.kind).sort()).toEqual(["placed", "replayed"]);
      const made = await db.select().from(orders).where(eq(orders.idempotencyKey, draftId));
      expect(made).toHaveLength(1);
    });

    it("refuses in the fixed order and writes nothing", async () => {
      const { draftId, lineId } = await readyDraft();
      const send = (expectedTotal = 3_000) =>
        sendDraftInDb(db, { userId: owner, draftId, expectedTotal, placedAt });

      expect(await send(1)).toEqual({ kind: "price_changed" });
      await db.update(products).set({ isAvailable: false }).where(eq(products.id, productB));
      expect(await send()).toEqual({ kind: "not_sellable" });
      await updateDraftLineInDb(db, owner, { lineId, quantity: null });
      // Incomplete comes before not sellable.
      expect(await send()).toEqual({
        kind: "incomplete",
        problems: [{ lineId, position: 1, reason: "no_quantity" }],
      });
      await removeDraftLineInDb(db, owner, lineId);
      expect(await send()).toEqual({ kind: "empty" });
      expect(await db.select().from(orders).where(eq(orders.idempotencyKey, draftId))).toEqual([]);
    });

    it("reports a missing fulfilment as required, and an inactive zone", async () => {
      const { draftId } = await readyDraft();
      await db
        .update(drafts)
        .set({ fulfilment: null, customerName: null })
        .where(eq(drafts.id, draftId));
      const outcome = await sendDraftInDb(db, {
        userId: owner,
        draftId,
        expectedTotal: 3_000,
        placedAt,
      });
      expect(outcome).toMatchObject({
        kind: "invalid",
        fieldErrors: { fulfilment: { code: "required" }, name: { code: "too_short" } },
      });

      const [inactive] = await db
        .insert(deliveryZones)
        .values({ name: "منطقة drf مغلقة", shortName: "drf", fee: 1_000, isActive: false })
        .returning();
      await saveDraftCustomerInDb(db, owner, {
        draftId,
        customerName: "محمد علي",
        fulfilment: "delivery",
        deliveryZoneId: inactive.id,
        city: "رام الله",
        address: "شارع الإرسال، عمارة 4",
      });
      expect(
        await sendDraftInDb(db, { userId: owner, draftId, expectedTotal: 4_000, placedAt }),
      ).toEqual({ kind: "zone_invalid" });
      await db.delete(deliveryZones).where(eq(deliveryZones.id, inactive.id));
    });
  });

  it("archives a product that sits only on a draft instead of deleting it", async () => {
    const { lineId } = await newDraft();
    await updateDraftLineInDb(db, owner, { lineId, productId: productA, variantId: null });
    const [row] = await db.select().from(products).where(eq(products.id, productA));
    const outcome = await deleteProductInDb(db, productA, row.version);
    expect(outcome.kind).toBe("archived");
    await db.update(products).set({ status: "active" }).where(eq(products.id, productA));
  });
});
