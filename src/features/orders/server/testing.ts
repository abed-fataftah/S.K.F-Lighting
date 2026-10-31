// Order rows for `*.db.test.ts` only: an admin account, and an order with one line and its
// `created` event, as checkout writes them. Never imported by the app.
import { sql } from "drizzle-orm";
import { orderEvents, orderLines, orders, profiles } from "@/server/db/schema";
import type { Transaction } from "@/server/db/types";
import { allocateOrderNumber } from "./order-number";

/** An auth user promoted to `admin` (the trigger gives it a `customer` profile first). */
export async function insertAdminUser(tx: Transaction, email = "owner-orders@example.test") {
  const [user] = await tx.execute<{ id: string }>(sql`
    insert into auth.users (id, aud, role, email)
    values (gen_random_uuid(), 'authenticated', 'authenticated', ${email})
    returning id`);
  await tx
    .update(profiles)
    .set({ role: "admin" })
    .where(sql`${profiles.id} = ${user.id}`);
  return user.id;
}

/** A plain auth user; the trigger gives it a `customer` profile. */
export async function insertCustomerUser(tx: Transaction, email: string) {
  const [user] = await tx.execute<{ id: string }>(sql`
    insert into auth.users (id, aud, role, email)
    values (gen_random_uuid(), 'authenticated', 'authenticated', ${email})
    returning id`);
  return user.id;
}

export type TestOrder = {
  readonly placedAt: Date;
  readonly variant: { readonly id: string; readonly productId: string };
  readonly fulfilment?: "pickup" | "delivery";
  readonly status?: typeof orders.$inferInsert.status;
  readonly phoneE164?: string;
  readonly placedByRole?: typeof orders.$inferInsert.placedByRole;
  /** The account that placed it (spec 0017); null for a guest order. */
  readonly placedByUserId?: string | null;
  /** False writes the `created` event already seen. */
  readonly unseen?: boolean;
};

export async function insertTestOrder(tx: Transaction, order: TestOrder) {
  const zone = order.fulfilment === "delivery" ? await anyZone(tx) : null;
  const status = order.status ?? "new";
  const [row] = await tx
    .insert(orders)
    .values({
      orderNumber: await allocateOrderNumber(tx, order.placedAt),
      customerName: "زبون اختبار",
      customerPhone: "0599123456",
      customerPhoneE164: order.phoneE164 ?? "+970599123456",
      placedByRole: order.placedByRole ?? null,
      placedByUserId: order.placedByUserId ?? null,
      fulfilment: order.fulfilment ?? "pickup",
      ...(zone
        ? {
            deliveryZoneId: zone.id,
            deliveryZoneName: zone.name,
            deliveryFee: 2_000,
            city: "رام الله",
            address: "شارع الإرسال، عمارة 4",
          }
        : {}),
      subtotal: 25_000,
      total: zone ? 27_000 : 25_000,
      status,
      ...(status === "delivered" ? { deliveredAt: order.placedAt } : {}),
      ...(status === "cancelled" ? { cancelledAt: order.placedAt, cancelledBy: "admin" } : {}),
      placedAt: order.placedAt,
    })
    .returning();
  await tx.insert(orderLines).values({
    orderId: row.id,
    productId: order.variant.productId,
    variantId: order.variant.id,
    productName: "ثريا اختبار",
    productCode: "TEST-ADM",
    quantity: 2,
    catalogUnitPrice: 12_500,
    unitPrice: 12_500,
    lineTotal: 25_000,
  });
  await tx.insert(orderEvents).values({
    orderId: row.id,
    type: "created",
    actorKind: "guest",
    createdAt: order.placedAt,
    seenAt: order.unseen === false ? order.placedAt : null,
  });
  return row;
}

async function anyZone(tx: Transaction) {
  const [zone] = await tx.execute<{ id: string; name: string }>(
    sql`select id, name from delivery_zones order by sort limit 1`,
  );
  if (!zone) throw new Error("No delivery zone: run pnpm db:seed first");
  return zone;
}
