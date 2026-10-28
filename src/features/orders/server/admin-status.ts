import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { orderEvents, orders } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { CancelOrderInput, ChangeStatusInput } from "../schemas";
import { isAllowedMove, orderMoves, type WritableStatus } from "../status";

// The owner's status writes (spec 0014 AC-3, AC-4). Each runs in one transaction: the order is
// read `for update`, checked against the status the page showed, then updated only while it
// still holds that status, with exactly one event row written seen (your own moves never flag).

type Db = Database | Transaction;

export type MoveError = "not_found" | "stale" | "not_allowed";

export type MoveResult<S extends WritableStatus> =
  Ok<{ readonly status: S; readonly number: string }> | Fail<MoveError>;

async function lockOrder(tx: Transaction, orderId: string) {
  const [order] = await tx
    .select({ number: orders.orderNumber, status: orders.status, fulfilment: orders.fulfilment })
    .from(orders)
    .where(eq(orders.id, orderId))
    .for("update");
  return order ?? null;
}

class Stale extends Error {}

/** The guarded update; a row that changed under the lock (it cannot, but) rolls back as `stale`. */
async function updateWhileAt(
  tx: Transaction,
  input: { readonly orderId: string; readonly from: ChangeStatusInput["from"] },
  set: PgUpdateSetSource<typeof orders>,
) {
  const updated = await tx
    .update(orders)
    .set(set)
    .where(and(eq(orders.id, input.orderId), eq(orders.status, input.from)))
    .returning({ id: orders.id });
  if (updated.length !== 1) throw new Stale();
}

const staleOnRace = <T>(run: Promise<T>): Promise<T | Fail<"stale">> =>
  run.catch((error: unknown) => {
    if (error instanceof Stale) return fail("stale");
    throw error;
  });

/** Moves an order one step on, a few steps on, or one step back (AC-3). */
export function changeOrderStatusInDb(
  db: Db,
  actorUserId: string,
  input: ChangeStatusInput,
): Promise<MoveResult<ChangeStatusInput["to"]>> {
  return staleOnRace(
    db.transaction(async (tx) => {
      const order = await lockOrder(tx, input.orderId);
      if (!order) return fail("not_found");
      // Compared as stored, so a `confirmed` row is not `new` here.
      if (order.status !== input.from) return fail("stale");
      if (!isAllowedMove(order.fulfilment, input.from, input.to)) return fail("not_allowed");

      await updateWhileAt(tx, input, {
        status: input.to,
        ...(input.to === "delivered" ? { deliveredAt: sql`now()` } : {}),
      });
      await tx.insert(orderEvents).values({
        orderId: input.orderId,
        type: "status_changed",
        actorKind: "admin",
        actorUserId,
        fromStatus: input.from,
        toStatus: input.to,
        data: {},
        seenAt: sql`now()`,
      });
      return ok({ status: input.to, number: order.number });
    }),
  );
}

/** Cancels an order that is not final yet; the reason lives only on the order (AC-4). */
export function cancelOrderInDb(
  db: Db,
  actorUserId: string,
  input: CancelOrderInput,
): Promise<MoveResult<"cancelled">> {
  return staleOnRace(
    db.transaction(async (tx) => {
      const order = await lockOrder(tx, input.orderId);
      if (!order) return fail("not_found");
      if (order.status !== input.from) return fail("stale");
      if (!orderMoves(order.fulfilment, input.from).canCancel) return fail("not_allowed");

      await updateWhileAt(tx, input, {
        status: "cancelled",
        cancelledAt: sql`now()`,
        cancelledBy: "admin",
        cancelReason: input.reason,
      });
      await tx.insert(orderEvents).values({
        orderId: input.orderId,
        type: "cancelled",
        actorKind: "admin",
        actorUserId,
        fromStatus: input.from,
        toStatus: "cancelled",
        data: {},
        seenAt: sql`now()`,
      });
      return ok({ status: "cancelled" as const, number: order.number });
    }),
  );
}
