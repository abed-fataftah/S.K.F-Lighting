import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  categories,
  colours,
  orderEvents,
  orderLines,
  orderNumberCounters,
  orders,
  payments,
  products,
} from "@/server/db/schema";
import { pgErrorOf } from "@/server/db/pg-error";
import {
  expectViolation,
  hasLocalDb,
  insertSimpleProduct,
  withRollback,
} from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";
import { netPaid } from "../ledger";
import type { PaymentInput, ReversalInput } from "../schemas";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { recordPaymentInDb, reversePaymentInDb } = await import("./record");
const { readOrderPayments } = await import("./queries");
const { insertAdminUser, insertTestOrder } = await import("@/features/orders/server/testing");

// covers: AC-4, AC-5, AC-6, AC-7, AC-8, AC-14, AC-17 (spec 0023)

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// The order is placed on the shop day 2094-07-01; "today" for every action is 2094-07-10.
const at = new Date("2094-07-01T08:00:00Z");
const PLACED_DAY = "2094-07-01";
const TODAY = "2094-07-10";

type OrderOptions = Partial<Parameters<typeof insertTestOrder>[1]>;

/** A ₪250 pickup order and the owner who records against it. */
async function setup(tx: Transaction, order: OrderOptions = {}) {
  const { variant } = await insertSimpleProduct(tx, "TEST-PAY");
  const adminId = await insertAdminUser(tx);
  const row = await insertTestOrder(tx, { placedAt: at, variant, unseen: false, ...order });
  return { adminId, orderId: row.id, number: row.orderNumber };
}

/** Another order of the same shop, for ids that belong elsewhere. */
async function otherOrder(tx: Transaction) {
  const { variant } = await insertSimpleProduct(tx, "TEST-PAY2");
  const row = await insertTestOrder(tx, { placedAt: at, variant, unseen: false });
  return { orderId: row.id };
}

const pay = (
  orderId: string,
  expectedAmountPaid: number,
  amount: number,
  extra: Partial<PaymentInput> = {},
): PaymentInput => ({
  paymentId: crypto.randomUUID(),
  orderId,
  kind: "payment",
  expectedAmountPaid,
  amount,
  method: "cash",
  cheque: null,
  receivedOn: PLACED_DAY,
  note: undefined,
  ...extra,
});

const cheque = { number: "001234", bank: "بنك فلسطين", dueDate: "2094-08-01" };

const reverse = (
  orderId: string,
  paymentId: string,
  expectedAmountPaid: number,
  reason = "شيك مرتجع",
): ReversalInput => ({
  reversalId: crypto.randomUUID(),
  orderId,
  paymentId,
  expectedAmountPaid,
  reason,
});

const paidOf = async (tx: Transaction, orderId: string) =>
  (await tx.select({ paid: orders.amountPaid }).from(orders).where(eq(orders.id, orderId)))[0].paid;

const eventsOf = (tx: Transaction, orderId: string) =>
  tx
    .select()
    .from(orderEvents)
    .where(sql`${orderEvents.orderId} = ${orderId} and ${orderEvents.type} = 'payment_recorded'`)
    .orderBy(orderEvents.createdAt);

const rowsOf = (tx: Transaction, orderId: string) =>
  tx.select().from(payments).where(eq(payments.orderId, orderId));

const cancel = (tx: Transaction, orderId: string) =>
  tx
    .update(orders)
    .set({ status: "cancelled", cancelledAt: at, cancelledBy: "admin" })
    .where(eq(orders.id, orderId));

describe.skipIf(!hasLocalDb)("recordPaymentInDb on the local database", () => {
  it("writes the row, amount_paid, and one seen event", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId, number } = await setup(tx);
      const input = pay(orderId, 0, 10_000, { note: "دفعة أولى" });
      expect(await recordPaymentInDb(tx, adminId, input, TODAY)).toEqual({
        ok: true,
        data: {
          amountPaid: 10_000,
          duplicate: false,
          number,
          kind: "payment",
          method: "cash",
          amount: 10_000,
          fromPaid: 0,
        },
      });
      expect(await paidOf(tx, orderId)).toBe(10_000);
      const [row] = await rowsOf(tx, orderId);
      expect(row).toMatchObject({
        id: input.paymentId,
        kind: "payment",
        method: "cash",
        amount: 10_000,
        receivedOn: PLACED_DAY,
        chequeNumber: null,
        note: "دفعة أولى",
        recordedBy: adminId,
      });
      const events = await eventsOf(tx, orderId);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ actorKind: "admin", actorUserId: adminId });
      expect(events[0].seenAt).not.toBeNull();
      expect(events[0].data).toEqual({
        paymentId: input.paymentId,
        kind: "payment",
        method: "cash",
        amount: 10_000,
        fromPaid: 0,
        toPaid: 10_000,
      });
    });
  });

  it("keeps a cheque's number, bank, and date, and pays up to the total exactly", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      await recordPaymentInDb(tx, adminId, pay(orderId, 0, 10_000), TODAY);
      const result = await recordPaymentInDb(
        tx,
        adminId,
        pay(orderId, 10_000, 15_000, { method: "cheque", cheque, receivedOn: TODAY }),
        TODAY,
      );
      expect(result).toMatchObject({ ok: true, data: { amountPaid: 25_000 } });
      const rows = await rowsOf(tx, orderId);
      expect(rows.find((row) => row.method === "cheque")).toMatchObject({
        chequeNumber: "001234",
        chequeBank: "بنك فلسطين",
        chequeDueDate: "2094-08-01",
      });
    });
  });

  it("answers a retried id with duplicate and writes nothing, even after a cancel", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      const input = pay(orderId, 0, 10_000);
      await recordPaymentInDb(tx, adminId, input, TODAY);
      expect(await recordPaymentInDb(tx, adminId, { ...input, amount: 999 }, TODAY)).toMatchObject({
        ok: true,
        data: { amountPaid: 10_000, duplicate: true, amount: 10_000 },
      });
      await cancel(tx, orderId);
      expect(await recordPaymentInDb(tx, adminId, input, TODAY)).toMatchObject({
        ok: true,
        data: { duplicate: true },
      });
      expect(await rowsOf(tx, orderId)).toHaveLength(1);
      expect(await eventsOf(tx, orderId)).toHaveLength(1);
      expect(await paidOf(tx, orderId)).toBe(10_000);
    });
  });

  it("throws on a retried id that belongs to another order", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      const other = await otherOrder(tx);
      const input = pay(orderId, 0, 10_000);
      await recordPaymentInDb(tx, adminId, input, TODAY);
      await expect(
        tx.transaction((sp) =>
          recordPaymentInDb(sp, adminId, { ...input, orderId: other.orderId }, TODAY),
        ),
      ).rejects.toThrow(/another order/);
    });
  });

  it("answers not_allowed for a payment on a cancelled order and a refund on a live one", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      expect(
        await recordPaymentInDb(tx, adminId, pay(orderId, 0, 100, { kind: "refund" }), TODAY),
      ).toEqual({ ok: false, error: "not_allowed" });
      await cancel(tx, orderId);
      expect(await recordPaymentInDb(tx, adminId, pay(orderId, 0, 100), TODAY)).toEqual({
        ok: false,
        error: "not_allowed",
      });
      expect(await rowsOf(tx, orderId)).toHaveLength(0);
    });
  });

  it("checks the status before the expected amount", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      await cancel(tx, orderId);
      expect(await recordPaymentInDb(tx, adminId, pay(orderId, 5_000, 100), TODAY)).toEqual({
        ok: false,
        error: "not_allowed",
      });
    });
  });

  it("answers stale, too_much with the locked limit, and before_order, writing nothing", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      await recordPaymentInDb(tx, adminId, pay(orderId, 0, 10_000), TODAY);
      expect(await recordPaymentInDb(tx, adminId, pay(orderId, 0, 100), TODAY)).toEqual({
        ok: false,
        error: "stale",
      });
      expect(await recordPaymentInDb(tx, adminId, pay(orderId, 10_000, 15_001), TODAY)).toEqual({
        ok: false,
        error: "too_much",
        limit: 15_000,
      });
      expect(
        await recordPaymentInDb(
          tx,
          adminId,
          pay(orderId, 10_000, 100, { receivedOn: "2094-06-30" }),
          TODAY,
        ),
      ).toEqual({ ok: false, error: "invalid", fieldErrors: { receivedOn: "before_order" } });
      expect(await rowsOf(tx, orderId)).toHaveLength(1);
      expect(await paidOf(tx, orderId)).toBe(10_000);
    });
  });

  it("answers not_found for an unknown order", async () => {
    await withRollback(db, async (tx) => {
      const { adminId } = await setup(tx);
      expect(await recordPaymentInDb(tx, adminId, pay(crypto.randomUUID(), 0, 100), TODAY)).toEqual(
        { ok: false, error: "not_found" },
      );
    });
  });

  it("records partial and full refunds on a cancelled order, down to 0", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      await recordPaymentInDb(tx, adminId, pay(orderId, 0, 10_000), TODAY);
      await cancel(tx, orderId);
      const refund = (expected: number, amount: number) =>
        recordPaymentInDb(tx, adminId, pay(orderId, expected, amount, { kind: "refund" }), TODAY);
      expect(await refund(10_000, 10_001)).toEqual({ ok: false, error: "too_much", limit: 10_000 });
      expect(await refund(10_000, 4_000)).toMatchObject({ ok: true, data: { amountPaid: 6_000 } });
      expect(await refund(6_000, 6_000)).toMatchObject({ ok: true, data: { amountPaid: 0 } });
    });
  });
});

describe.skipIf(!hasLocalDb)("reversePaymentInDb on the local database", () => {
  it("writes a reversal copying its target, moves amount_paid back, and logs one event", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      const paid = pay(orderId, 0, 10_000, { method: "cheque", cheque });
      await recordPaymentInDb(tx, adminId, paid, TODAY);
      const input = reverse(orderId, paid.paymentId, 10_000);
      expect(await reversePaymentInDb(tx, adminId, input, TODAY)).toMatchObject({
        ok: true,
        data: {
          amountPaid: 0,
          duplicate: false,
          kind: "reversal",
          amount: 10_000,
          fromPaid: 10_000,
        },
      });
      const [row] = await tx.select().from(payments).where(eq(payments.id, input.reversalId));
      expect(row).toMatchObject({
        kind: "reversal",
        reversesPaymentId: paid.paymentId,
        method: "cheque",
        amount: 10_000,
        chequeNumber: "001234",
        chequeBank: "بنك فلسطين",
        chequeDueDate: "2094-08-01",
        receivedOn: TODAY,
        note: "شيك مرتجع",
      });
      const events = await eventsOf(tx, orderId);
      expect(events.at(-1)?.data).toEqual({
        paymentId: input.reversalId,
        kind: "reversal",
        reverses: paid.paymentId,
        method: "cheque",
        amount: 10_000,
        fromPaid: 10_000,
        toPaid: 0,
      });
      expect(await reversePaymentInDb(tx, adminId, input, TODAY)).toMatchObject({
        ok: true,
        data: { duplicate: true, amountPaid: 0 },
      });
      expect(await rowsOf(tx, orderId)).toHaveLength(2);
    });
  });

  it("reverses a refund back up, on a cancelled order too", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      await recordPaymentInDb(tx, adminId, pay(orderId, 0, 10_000), TODAY);
      await cancel(tx, orderId);
      const refund = pay(orderId, 10_000, 4_000, { kind: "refund" });
      await recordPaymentInDb(tx, adminId, refund, TODAY);
      expect(
        await reversePaymentInDb(tx, adminId, reverse(orderId, refund.paymentId, 6_000), TODAY),
      ).toMatchObject({ ok: true, data: { amountPaid: 10_000 } });
    });
  });

  it("answers is_reversal, already_reversed, stale, and out_of_range, writing nothing", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      const first = pay(orderId, 0, 10_000);
      const second = pay(orderId, 10_000, 5_000);
      await recordPaymentInDb(tx, adminId, first, TODAY);
      await recordPaymentInDb(tx, adminId, second, TODAY);
      const undo = reverse(orderId, second.paymentId, 15_000);
      await reversePaymentInDb(tx, adminId, undo, TODAY);

      expect(
        await reversePaymentInDb(tx, adminId, reverse(orderId, undo.reversalId, 10_000), TODAY),
      ).toEqual({ ok: false, error: "is_reversal" });
      expect(
        await reversePaymentInDb(tx, adminId, reverse(orderId, second.paymentId, 10_000), TODAY),
      ).toEqual({ ok: false, error: "already_reversed" });
      expect(
        await reversePaymentInDb(tx, adminId, reverse(orderId, first.paymentId, 15_000), TODAY),
      ).toEqual({ ok: false, error: "stale" });

      // A payment a refund already paid back cannot be reversed below 0.
      await cancel(tx, orderId);
      await recordPaymentInDb(tx, adminId, pay(orderId, 10_000, 10_000, { kind: "refund" }), TODAY);
      expect(
        await reversePaymentInDb(tx, adminId, reverse(orderId, first.paymentId, 0), TODAY),
      ).toEqual({ ok: false, error: "out_of_range" });
      expect(await rowsOf(tx, orderId)).toHaveLength(4);
      expect(await paidOf(tx, orderId)).toBe(0);
    });
  });

  it("answers out_of_range above the total, through a direct fixture", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      await recordPaymentInDb(tx, adminId, pay(orderId, 0, 25_000), TODAY);
      await cancel(tx, orderId);
      const refund = pay(orderId, 25_000, 5_000, { kind: "refund" });
      await recordPaymentInDb(tx, adminId, refund, TODAY);
      // The only way above the total: a fixture puts the order back at its full total.
      await tx.update(orders).set({ amountPaid: 25_000 }).where(eq(orders.id, orderId));
      expect(
        await reversePaymentInDb(tx, adminId, reverse(orderId, refund.paymentId, 25_000), TODAY),
      ).toEqual({ ok: false, error: "out_of_range" });
    });
  });

  it("answers not_found for a payment of another order", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      const other = await otherOrder(tx);
      const elsewhere = pay(other.orderId, 0, 1_000);
      await recordPaymentInDb(tx, adminId, elsewhere, TODAY);
      expect(
        await reversePaymentInDb(tx, adminId, reverse(orderId, elsewhere.paymentId, 0), TODAY),
      ).toEqual({ ok: false, error: "not_found" });
    });
  });

  it("keeps amount_paid equal to netPaid after a mixed run", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      const a = pay(orderId, 0, 10_000);
      await recordPaymentInDb(tx, adminId, a, TODAY);
      const b = pay(orderId, 10_000, 15_000, { method: "cheque", cheque });
      await recordPaymentInDb(tx, adminId, b, TODAY);
      await reversePaymentInDb(tx, adminId, reverse(orderId, b.paymentId, 25_000), TODAY);
      await recordPaymentInDb(tx, adminId, pay(orderId, 10_000, 7_500), TODAY);
      await cancel(tx, orderId);
      const r = pay(orderId, 17_500, 2_500, { kind: "refund" });
      await recordPaymentInDb(tx, adminId, r, TODAY);
      await reversePaymentInDb(tx, adminId, reverse(orderId, r.paymentId, 15_000), TODAY);
      await recordPaymentInDb(tx, adminId, pay(orderId, 17_500, 17_500, { kind: "refund" }), TODAY);

      const rows = await readOrderPayments(tx, orderId);
      expect(rows).toHaveLength(7);
      expect(await paidOf(tx, orderId)).toBe(netPaid(rows));
      expect(netPaid(rows)).toBe(0);
    });
  });
});

describe.skipIf(!hasLocalDb)("the payments table", () => {
  const refused = async (tx: Transaction, run: (sp: Transaction) => Promise<unknown>) => {
    const error = await tx.transaction(run).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error, "expected the trigger to refuse").not.toBeNull();
    expect(pgErrorOf(error)?.code).toBe("23001");
  };

  it("refuses update, delete, and truncate, and keeps the order through restrict", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      const input = pay(orderId, 0, 10_000);
      await recordPaymentInDb(tx, adminId, input, TODAY);
      await refused(tx, (sp) =>
        sp.update(payments).set({ amount: 1 }).where(eq(payments.id, input.paymentId)),
      );
      await refused(tx, (sp) => sp.delete(payments).where(eq(payments.id, input.paymentId)));
      await refused(tx, (sp) => sp.execute(sql`truncate public.payments`));
      const orderDelete = await tx
        .transaction((sp) => sp.delete(orders).where(eq(orders.id, orderId)))
        .then(
          () => null,
          (caught: unknown) => caught,
        );
      expect(pgErrorOf(orderDelete)?.code).toBe("23503");
    });
  });

  it("holds every check, amount_paid <= total on orders included", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, orderId } = await setup(tx);
      const base = {
        orderId,
        kind: "payment" as const,
        method: "cash" as const,
        amount: 100,
        receivedOn: PLACED_DAY,
        recordedBy: adminId,
      };
      const [target] = await tx.insert(payments).values(base).returning({ id: payments.id });

      await expectViolation(tx, "payments_amount_check", (sp) =>
        sp.insert(payments).values({ ...base, amount: 0 }),
      );
      await expectViolation(tx, "payments_cheque_check", (sp) =>
        sp
          .insert(payments)
          .values({ ...base, method: "cheque", chequeNumber: "1", chequeBank: "ب" }),
      );
      await expectViolation(tx, "payments_cheque_check", (sp) =>
        sp.insert(payments).values({ ...base, chequeNumber: "1" }),
      );
      await expectViolation(tx, "payments_reversal_check", (sp) =>
        sp.insert(payments).values({ ...base, kind: "reversal", note: "سبب" }),
      );
      await expectViolation(tx, "payments_reversal_check", (sp) =>
        sp.insert(payments).values({ ...base, reversesPaymentId: target.id }),
      );
      await expectViolation(tx, "payments_reversal_note_check", (sp) =>
        sp
          .insert(payments)
          .values({ ...base, kind: "reversal", reversesPaymentId: target.id, note: "  " }),
      );
      const selfId = crypto.randomUUID();
      await expectViolation(tx, "payments_not_self_check", (sp) =>
        sp.insert(payments).values({
          ...base,
          id: selfId,
          kind: "reversal",
          reversesPaymentId: selfId,
          note: "سبب",
        }),
      );
      await tx
        .insert(payments)
        .values({ ...base, kind: "reversal", reversesPaymentId: target.id, note: "سبب" });
      await expectViolation(tx, "payments_reverses_payment_id_unique", (sp) =>
        sp
          .insert(payments)
          .values({ ...base, kind: "reversal", reversesPaymentId: target.id, note: "سبب" }),
      );
      await expectViolation(tx, "orders_amount_paid_total_check", (sp) =>
        sp.update(orders).set({ amountPaid: 25_001 }).where(eq(orders.id, orderId)),
      );
    });
  });
});

// covers: AC-8 (spec 0023). Two connections need committed rows; cleanup turns the append only
// triggers off for its own transaction only (the spec 0022 pattern).
describe.skipIf(!hasLocalDb)("two tabs recording at once", () => {
  const YEAR = 2088;
  const CODE = "PAY-RACE";
  const EMAIL = "pay-race-owner@example.test";
  const second = hasLocalDb ? getDirectDb() : (null as never);

  async function cleanUp() {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      const placed = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(like(orders.orderNumber, `${String(YEAR).slice(2)}-%`));
      const ids = placed.map((order) => order.id);
      if (ids.length) {
        await tx.delete(payments).where(inArray(payments.orderId, ids));
        await tx.delete(orderEvents).where(inArray(orderEvents.orderId, ids));
        await tx.delete(orderLines).where(inArray(orderLines.orderId, ids));
        await tx.delete(orders).where(inArray(orders.id, ids));
      }
      await tx.delete(orderNumberCounters).where(eq(orderNumberCounters.year, YEAR));
      await tx.execute(sql`delete from auth.users where email = ${EMAIL}`);
      await tx.delete(products).where(like(products.code, `${CODE}%`));
      await tx.delete(categories).where(like(categories.slug, `test-${CODE.toLowerCase()}%`));
      await tx.delete(colours).where(eq(colours.name, `لون ${CODE}`));
    });
  }

  afterAll(async () => {
    await cleanUp();
    await second.$client.end();
  });

  it("lets one win and answers stale to the other, with nothing of it written", async () => {
    await cleanUp();
    const made = await db.transaction(async (tx) => {
      const { variant } = await insertSimpleProduct(tx, CODE);
      const adminId = await insertAdminUser(tx, EMAIL);
      const row = await insertTestOrder(tx, {
        placedAt: new Date(`${YEAR}-01-01T09:00:00Z`),
        variant,
        unseen: false,
      });
      return { adminId, orderId: row.id };
    });

    const record = (on: typeof db, amount: number) =>
      recordPaymentInDb(
        on,
        made.adminId,
        pay(made.orderId, 0, amount, { receivedOn: `${YEAR}-01-01` }),
        `${YEAR}-01-05`,
      );
    const results = await Promise.all([record(db, 10_000), record(second, 11_000)]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, error: "stale" }]);
    const winner = results[0].ok ? 10_000 : 11_000;
    const rows = await db.select().from(payments).where(eq(payments.orderId, made.orderId));
    expect(rows.map((row) => row.amount)).toEqual([winner]);
    const [order] = await db.select().from(orders).where(eq(orders.id, made.orderId));
    expect(order.amountPaid).toBe(winner);
  });
});
