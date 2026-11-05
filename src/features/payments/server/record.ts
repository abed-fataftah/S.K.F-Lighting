import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { shopDateKey } from "@/lib/format";
import { fail, ok, type Ok } from "@/lib/result";
import { orderEvents, orders, payments } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { applyEntry, paymentLimit, type PaymentKind, type PaymentMethod } from "../ledger";
import type { PaymentInput, RecordFail, Recorded, ReversalInput, ReverseFail } from "../schemas";

// The two ledger writes (spec 0023 AC-4, AC-6): each is one transaction that locks the order row
// first (the lock order of spec 0022, so payments, price cuts, and cancels on one order run one
// after another), checks in the spec's fixed order, then inserts the row, moves
// `orders.amount_paid`, and writes one seen `payment_recorded` event. A refusal writes nothing; a
// retried id answers `duplicate` and writes nothing.

type Db = Database | Transaction;

/** What the action logs and revalidates, beside what it returns. */
export type Written = Recorded & {
  readonly number: string;
  readonly kind: PaymentKind;
  readonly method: PaymentMethod;
  readonly amount: number;
  readonly fromPaid: number;
};

function lockOrder(tx: Transaction, orderId: string) {
  return tx
    .select({
      number: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      amountPaid: orders.amountPaid,
      placedAt: orders.placedAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .for("update")
    .then((rows) => rows[0]);
}

/**
 * The row a retry already wrote, as a `duplicate` success. The first request won, whatever the
 * order's state now or the payload says. The same id on another order is a bug, so it throws.
 */
async function earlierWrite(
  tx: Transaction,
  id: string,
  order: { readonly number: string; readonly amountPaid: number },
  orderId: string,
): Promise<Ok<Written> | null> {
  const [row] = await tx
    .select({
      orderId: payments.orderId,
      kind: payments.kind,
      method: payments.method,
      amount: payments.amount,
    })
    .from(payments)
    .where(eq(payments.id, id));
  if (!row) return null;
  if (row.orderId !== orderId) throw new Error(`payment id ${id} belongs to another order`);
  return ok({
    amountPaid: order.amountPaid,
    duplicate: true,
    number: order.number,
    kind: row.kind,
    method: row.method,
    amount: row.amount,
    fromPaid: order.amountPaid,
  });
}

export function recordPaymentInDb(
  db: Db,
  adminUserId: string,
  input: PaymentInput,
  today: string,
): Promise<Ok<Written> | RecordFail> {
  return db.transaction(async (tx): Promise<Ok<Written> | RecordFail> => {
    const order = await lockOrder(tx, input.orderId);
    if (!order) return fail("not_found");
    const earlier = await earlierWrite(tx, input.paymentId, order, input.orderId);
    if (earlier) return earlier;

    const cancelled = order.status === "cancelled";
    if (cancelled !== (input.kind === "refund")) return fail("not_allowed");
    if (order.amountPaid !== input.expectedAmountPaid) return fail("stale");
    const limit = paymentLimit(input.kind, order.total, order.amountPaid);
    if (input.amount > limit) return { ...fail("too_much"), limit };
    if (input.receivedOn < shopDateKey(order.placedAt)) {
      return { ...fail("invalid"), fieldErrors: { receivedOn: "before_order" } };
    }
    if (input.receivedOn > today) {
      return { ...fail("invalid"), fieldErrors: { receivedOn: "date_future" } };
    }

    const toPaid = applyEntry(order.amountPaid, { kind: input.kind, amount: input.amount });
    await tx.insert(payments).values({
      id: input.paymentId,
      orderId: input.orderId,
      kind: input.kind,
      method: input.method,
      amount: input.amount,
      receivedOn: input.receivedOn,
      chequeNumber: input.cheque?.number ?? null,
      chequeBank: input.cheque?.bank ?? null,
      chequeDueDate: input.cheque?.dueDate ?? null,
      note: input.note ?? null,
      recordedBy: adminUserId,
    });
    await tx.update(orders).set({ amountPaid: toPaid }).where(eq(orders.id, input.orderId));
    await tx.insert(orderEvents).values({
      orderId: input.orderId,
      type: "payment_recorded",
      actorKind: "admin",
      actorUserId: adminUserId,
      data: {
        paymentId: input.paymentId,
        kind: input.kind,
        method: input.method,
        amount: input.amount,
        fromPaid: order.amountPaid,
        toPaid,
      },
      seenAt: sql`now()`,
    });

    return ok({
      amountPaid: toPaid,
      duplicate: false,
      number: order.number,
      kind: input.kind,
      method: input.method,
      amount: input.amount,
      fromPaid: order.amountPaid,
    });
  });
}

export function reversePaymentInDb(
  db: Db,
  adminUserId: string,
  input: ReversalInput,
  today: string,
): Promise<Ok<Written> | ReverseFail> {
  return db.transaction(async (tx): Promise<Ok<Written> | ReverseFail> => {
    const order = await lockOrder(tx, input.orderId);
    if (!order) return fail("not_found");
    const earlier = await earlierWrite(tx, input.reversalId, order, input.orderId);
    if (earlier) return earlier;

    const [target] = await tx
      .select({
        id: payments.id,
        kind: payments.kind,
        method: payments.method,
        amount: payments.amount,
        chequeNumber: payments.chequeNumber,
        chequeBank: payments.chequeBank,
        chequeDueDate: payments.chequeDueDate,
      })
      .from(payments)
      .where(and(eq(payments.id, input.paymentId), eq(payments.orderId, input.orderId)))
      .for("update");
    if (!target) return fail("not_found");
    if (target.kind === "reversal") return fail("is_reversal");
    const [reversed] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.reversesPaymentId, target.id));
    if (reversed) return fail("already_reversed");
    if (order.amountPaid !== input.expectedAmountPaid) return fail("stale");

    const signed = target.kind === "payment" ? -target.amount : target.amount;
    const raw = order.amountPaid + signed;
    if (raw < 0 || raw > order.total) return fail("out_of_range");
    const toPaid = applyEntry(order.amountPaid, {
      kind: "reversal",
      amount: target.amount,
      reversedKind: target.kind,
    });

    await tx.insert(payments).values({
      id: input.reversalId,
      orderId: input.orderId,
      kind: "reversal",
      method: target.method,
      amount: target.amount,
      receivedOn: today,
      chequeNumber: target.chequeNumber,
      chequeBank: target.chequeBank,
      chequeDueDate: target.chequeDueDate,
      reversesPaymentId: target.id,
      note: input.reason,
      recordedBy: adminUserId,
    });
    await tx.update(orders).set({ amountPaid: toPaid }).where(eq(orders.id, input.orderId));
    await tx.insert(orderEvents).values({
      orderId: input.orderId,
      type: "payment_recorded",
      actorKind: "admin",
      actorUserId: adminUserId,
      data: {
        paymentId: input.reversalId,
        kind: "reversal",
        reverses: target.id,
        method: target.method,
        amount: target.amount,
        fromPaid: order.amountPaid,
        toPaid,
      },
      seenAt: sql`now()`,
    });

    return ok({
      amountPaid: toPaid,
      duplicate: false,
      number: order.number,
      kind: "reversal",
      method: target.method,
      amount: target.amount,
      fromPaid: order.amountPaid,
    });
  });
}
