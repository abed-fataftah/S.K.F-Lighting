import "server-only";
import { and, eq } from "drizzle-orm";
import { buildCartView, checkoutTotal, type CartView } from "@/features/cart/cart-view";
import type { CartLine } from "@/features/cart/cart-cookie";
import { readCartRows } from "@/features/cart/server/cart-rows";
import { allocateOrderNumber } from "@/features/orders/server/order-number";
import { computeOrderTotals } from "@/features/orders/totals";
import { deliveryZones, orderEvents, orderLines, orders } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import type { CheckoutInput } from "../schemas";
import { readActiveZones, type DeliveryZoneOption } from "./checkout-options";

// The database half of `placeOrder` (spec 0004, placeOrder steps 3 to 7). The action parses the
// form, limits the rate, and owns the cookies and the redirect; this reads, checks, and writes in
// one transaction, and writes nothing until every check passes.

export type PlacedOrderRef = { readonly orderId: string; readonly orderNumber: string };

export type PlaceOrderOutcome =
  | ({
      readonly kind: "placed";
      readonly lineCount: number;
      readonly total: number;
    } & PlacedOrderRef)
  | ({ readonly kind: "replayed" } & PlacedOrderRef)
  | { readonly kind: "cart_empty" }
  | {
      readonly kind: "not_sellable";
      readonly cart: CartView;
      readonly zones: readonly DeliveryZoneOption[];
    }
  | {
      readonly kind: "zone_invalid";
      readonly cart: CartView;
      readonly zones: readonly DeliveryZoneOption[];
    }
  | {
      readonly kind: "price_changed";
      readonly cart: CartView;
      readonly zones: readonly DeliveryZoneOption[];
    };

/** Step 3: the order already saved for this checkout attempt, if any. */
export async function findOrderByKey(db: Database, key: string): Promise<PlacedOrderRef | null> {
  const [row] = await db
    .select({ orderId: orders.id, orderNumber: orders.orderNumber })
    .from(orders)
    .where(eq(orders.idempotencyKey, key))
    .limit(1);
  return row ?? null;
}

// Thrown inside the transaction when a concurrent submit with the same key won (step 6),
// so everything this attempt wrote, including its order number, rolls back.
class KeyTaken extends Error {}

export async function placeOrderInDb(
  db: Database,
  { input, cart, placedAt }: { input: CheckoutInput; cart: readonly CartLine[]; placedAt: Date },
): Promise<PlaceOrderOutcome> {
  const existing = await findOrderByKey(db, input.idempotencyKey);
  if (existing) return { kind: "replayed", ...existing };
  if (cart.length === 0) return { kind: "cart_empty" };

  try {
    return await db.transaction(async (tx): Promise<PlaceOrderOutcome> => {
      const rows = await readCartRows(
        tx,
        cart.map((line) => line.variantId),
      );
      const view = buildCartView(cart, rows);
      const delivery = input.fulfilment === "delivery";
      const [zone] = delivery
        ? await tx
            .select()
            .from(deliveryZones)
            .where(and(eq(deliveryZones.id, input.zoneId), eq(deliveryZones.isActive, true)))
        : [];
      const fresh = async () => ({ cart: view, zones: await readActiveZones(tx) });

      if (view.hasUnsellable) return { kind: "not_sellable", ...(await fresh()) };
      if (delivery && !zone) return { kind: "zone_invalid", ...(await fresh()) };
      const deliveryFee = zone?.fee ?? 0;
      if (checkoutTotal(view, deliveryFee) !== input.expectedTotal) {
        return { kind: "price_changed", ...(await fresh()) };
      }

      const byVariant = new Map(rows.map((row) => [row.variantId, row]));
      const lines = cart.map((line, sort) => {
        const row = byVariant.get(line.variantId)!;
        return { row, quantity: line.quantity, sort };
      });
      const totals = computeOrderTotals({
        lines: lines.map(({ row, quantity }) => ({ unitPrice: row.price, quantity })),
        deliveryFee,
        discountTotal: 0,
      });

      // The counter row lock queues concurrent orders, so the inserts below stay last.
      const orderNumber = await allocateOrderNumber(tx, placedAt);
      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          idempotencyKey: input.idempotencyKey,
          placedByUserId: null,
          placedByRole: null,
          customerName: input.name,
          customerPhone: input.phone.typed,
          customerPhoneE164: input.phone.e164,
          city: delivery ? input.city : null,
          area: null,
          address: delivery ? input.address : null,
          notes: input.notes ?? null,
          fulfilment: input.fulfilment,
          deliveryZoneId: zone?.id ?? null,
          deliveryZoneName: zone?.name ?? null,
          deliveryFee,
          subtotal: totals.subtotal,
          discountTotal: 0,
          total: totals.total,
          placedAt,
        })
        .onConflictDoNothing({ target: orders.idempotencyKey })
        .returning({ id: orders.id });
      if (!order) throw new KeyTaken();

      await tx.insert(orderLines).values(
        lines.map(({ row, quantity, sort }) => ({
          orderId: order.id,
          productId: row.productId,
          variantId: row.variantId,
          productName: row.productName,
          productCode: row.productCode,
          variantCode: row.variantCode,
          sizeLabel: row.sizeLabel,
          colourName: row.colourName,
          quantity,
          catalogUnitPrice: row.price,
          unitPrice: row.price,
          lineTotal: row.price * quantity,
          sort,
        })),
      );
      await tx
        .insert(orderEvents)
        .values({ orderId: order.id, type: "created", actorKind: "guest", data: {} });

      return {
        kind: "placed",
        orderId: order.id,
        orderNumber,
        lineCount: lines.length,
        total: totals.total,
      };
    });
  } catch (error) {
    if (!(error instanceof KeyTaken)) throw error;
    const winner = await findOrderByKey(db, input.idempotencyKey);
    if (!winner) throw new Error("placeOrder: the key was taken but no order holds it");
    return { kind: "replayed", ...winner };
  }
}
