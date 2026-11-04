import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { orderEvents, orderLinePriceChanges, orderLines, orders } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { canAdjustPrices, type AdjustedPriceError } from "../price-adjust";
import type { AdjustPricesInput } from "../schemas";
import { computeLineTotal } from "../totals";
import { recomputeOrderTotals } from "./totals";

// The price save (spec 0022 AC-4): one transaction that locks the order row, then the sent lines
// by id (any later money action takes the same order), checks in the spec's fixed order, then
// writes the lines, the totals, one seen `line_price_changed` event, and one change row per
// changed line. A refusal writes nothing.

type Db = Database | Transaction;

export type AdjustError =
  "not_found" | "not_electrician" | "locked" | "stale" | "invalid" | "no_change" | "below_paid";

export type AdjustFail =
  | Fail<Exclude<AdjustError, "invalid" | "below_paid">>
  | Fail<"invalid", { readonly lineErrors: Readonly<Record<string, AdjustedPriceError>> }>
  | Fail<"below_paid", { readonly paid: number }>;

export type AdjustResult =
  | Ok<{
      readonly number: string;
      readonly subtotal: number;
      readonly total: number;
      readonly fromTotal: number;
      readonly lineCount: number;
      readonly lines: readonly {
        readonly lineId: string;
        readonly unitPrice: number;
        readonly lineTotal: number;
      }[];
    }>
  | AdjustFail;

/** Thrown inside the transaction so the line updates roll back (AC-6 `below_paid`). */
class BelowPaid extends Error {
  constructor(readonly paid: number) {
    super("below_paid");
  }
}

export function adjustOrderPricesInDb(
  db: Db,
  adminUserId: string,
  input: AdjustPricesInput,
): Promise<AdjustResult> {
  return db
    .transaction(async (tx): Promise<AdjustResult> => {
      const [order] = await tx
        .select({
          number: orders.orderNumber,
          total: orders.total,
          amountPaid: orders.amountPaid,
          placedByRole: orders.placedByRole,
          status: orders.status,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .for("update");
      if (!order) return fail("not_found");

      const sentIds = input.lines.map((line) => line.lineId);
      const locked = await tx
        .select({
          id: orderLines.id,
          quantity: orderLines.quantity,
          catalogUnitPrice: orderLines.catalogUnitPrice,
          unitPrice: orderLines.unitPrice,
        })
        .from(orderLines)
        .where(and(eq(orderLines.orderId, input.orderId), inArray(orderLines.id, sentIds)))
        .orderBy(asc(orderLines.id))
        .for("update");
      if (locked.length !== sentIds.length) return fail("not_found");
      const stored = new Map(locked.map((line) => [line.id, line]));
      const sent = input.lines.map((line) => ({ ...line, stored: stored.get(line.lineId)! }));

      if (order.placedByRole !== "electrician") return fail("not_electrician");
      if (!canAdjustPrices(order.placedByRole, order.status)) return fail("locked");
      if (
        order.total !== input.expectedTotal ||
        sent.some((line) => line.stored.unitPrice !== line.expectedUnitPrice)
      ) {
        return fail("stale");
      }
      const lineErrors = Object.fromEntries(
        sent
          .filter((line) => line.price > line.stored.catalogUnitPrice)
          .map((line) => [line.lineId, "above_catalog" as const]),
      );
      if (Object.keys(lineErrors).length > 0) return { ...fail("invalid"), lineErrors };
      const changed = sent.filter((line) => line.price !== line.stored.unitPrice);
      if (changed.length === 0) return fail("no_change");

      const lines = [];
      for (const line of changed) {
        const lineTotal = computeLineTotal(line.price, line.stored.quantity);
        await tx
          .update(orderLines)
          .set({ unitPrice: line.price, lineTotal })
          .where(eq(orderLines.id, line.lineId));
        lines.push({ lineId: line.lineId, unitPrice: line.price, lineTotal });
      }
      const totals = await recomputeOrderTotals(tx, input.orderId);
      if (totals.total < order.amountPaid) throw new BelowPaid(order.amountPaid);

      const [event] = await tx
        .insert(orderEvents)
        .values({
          orderId: input.orderId,
          type: "line_price_changed",
          actorKind: "admin",
          actorUserId: adminUserId,
          data: {
            lineCount: changed.length,
            fromTotal: order.total,
            toTotal: totals.total,
            ...(input.note ? { note: input.note } : {}),
          },
          seenAt: sql`now()`,
        })
        .returning({ id: orderEvents.id });
      await tx.insert(orderLinePriceChanges).values(
        changed.map((line) => ({
          orderEventId: event.id,
          orderLineId: line.lineId,
          oldUnitPrice: line.stored.unitPrice,
          newUnitPrice: line.price,
        })),
      );

      return ok({
        number: order.number,
        subtotal: totals.subtotal,
        total: totals.total,
        fromTotal: order.total,
        lineCount: changed.length,
        lines,
      });
    })
    .catch((error: unknown) => {
      if (error instanceof BelowPaid) return { ...fail("below_paid"), paid: error.paid };
      throw error;
    });
}
