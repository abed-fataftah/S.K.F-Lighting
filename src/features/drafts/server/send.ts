import "server-only";
import { and, eq } from "drizzle-orm";
import { KeyTaken, writeOrder, type PlacedOrderRef } from "@/features/checkout/server/place-order";
import type { FieldErrors } from "@/lib/form-errors";
import { deliveryZones, drafts, orders } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { countsInTotal, draftTotals, lineProblems, type LineProblem } from "../draft-view";
import { parseDraftCustomer } from "../send-check";
import { readLineViews } from "./read-draft";

// The database half of `sendDraft` (spec 0020 AC-13). The checks run in a fixed order inside one
// transaction that locks the draft; only when all pass is the order written through the shared
// insert, and the draft deleted in the same transaction. The draft id is the order's key.

export type SendOutcome =
  | ({
      readonly kind: "placed";
      readonly lineCount: number;
      readonly total: number;
    } & PlacedOrderRef)
  | ({ readonly kind: "replayed" } & PlacedOrderRef)
  | { readonly kind: "not_found" }
  | { readonly kind: "empty" }
  | { readonly kind: "incomplete"; readonly problems: readonly LineProblem[] }
  | { readonly kind: "invalid"; readonly fieldErrors: FieldErrors }
  | { readonly kind: "not_sellable" }
  | { readonly kind: "zone_invalid" }
  | { readonly kind: "price_changed" };

/** The order this user placed from this draft id, if any; one placed by anyone else stays hidden. */
async function findOwnOrder(
  db: Database | Transaction,
  userId: string,
  draftId: string,
): Promise<PlacedOrderRef | null> {
  const [row] = await db
    .select({ orderId: orders.id, orderNumber: orders.orderNumber })
    .from(orders)
    .where(and(eq(orders.idempotencyKey, draftId), eq(orders.placedByUserId, userId)))
    .limit(1);
  return row ?? null;
}

export async function sendDraftInDb(
  db: Database,
  {
    userId,
    draftId,
    expectedTotal,
    placedAt,
  }: { userId: string; draftId: string; expectedTotal: number; placedAt: Date },
): Promise<SendOutcome> {
  const existing = await findOwnOrder(db, userId, draftId);
  if (existing) return { kind: "replayed", ...existing };

  try {
    return await db.transaction(async (tx): Promise<SendOutcome> => {
      const [draft] = await tx
        .select()
        .from(drafts)
        .where(and(eq(drafts.id, draftId), eq(drafts.ownerUserId, userId)))
        .for("update");
      if (!draft) {
        // A concurrent send may have just placed it and deleted the draft.
        const placed = await findOwnOrder(tx, userId, draftId);
        return placed ? { kind: "replayed", ...placed } : { kind: "not_found" };
      }

      const lines = await readLineViews(tx, draftId);
      if (lines.length === 0) return { kind: "empty" };
      const problems = lineProblems(lines);
      if (problems.length > 0) return { kind: "incomplete", problems };
      const customer = parseDraftCustomer(draft, draftId, expectedTotal);
      if (!customer.ok) return { kind: "invalid", fieldErrors: customer.fieldErrors };
      const input = customer.input;
      if (!lines.every(countsInTotal)) return { kind: "not_sellable" };

      const delivery = input.fulfilment === "delivery";
      const [zone] = delivery
        ? await tx
            .select({ id: deliveryZones.id, name: deliveryZones.name, fee: deliveryZones.fee })
            .from(deliveryZones)
            .where(and(eq(deliveryZones.id, input.zoneId), eq(deliveryZones.isActive, true)))
        : [];
      if (delivery && !zone) return { kind: "zone_invalid" };
      const totals = draftTotals(lines, zone ? zone.fee : null);
      if (totals.total !== expectedTotal) return { kind: "price_changed" };

      const written = await writeOrder(tx, {
        lines: lines.filter(countsInTotal).map((line) => ({
          row: {
            productId: line.product.id,
            variantId: line.option.id,
            productName: line.product.name,
            productCode: line.product.code,
            variantCode: line.option.code,
            sizeLabel: line.option.sizeLabel,
            colourName: line.option.colourName,
            price: line.option.price,
          },
          quantity: line.quantity,
        })),
        input,
        zone: zone ?? null,
        placedBy: { userId, role: "electrician" },
        placedAt,
      });
      await tx.delete(drafts).where(eq(drafts.id, draftId));
      return { kind: "placed", ...written };
    });
  } catch (error) {
    if (!(error instanceof KeyTaken)) throw error;
    const winner = await findOwnOrder(db, userId, draftId);
    return winner ? { kind: "replayed", ...winner } : { kind: "not_found" };
  }
}
