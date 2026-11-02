import type postgres from "postgres";

// Orders for the dashboard flows (spec 0014 AC-19), written straight to the local database the way
// checkout writes them: the next number of the shop year, one line, and an unseen `created` event.
// A flow that needs a real storefront order places it through the shop instead.

type Sql = postgres.Sql;

export type TestOrder = {
  readonly fulfilment?: "pickup" | "delivery";
  readonly status?: "new" | "preparing" | "ready" | "out_for_delivery";
  /** A national mobile without its leading 0, like `591234567`. */
  readonly national?: string;
  readonly role?: "customer" | "electrician" | null;
  /** Defaults to now. */
  readonly placedAt?: Date;
  readonly name?: string;
  /** The account that placed it (spec 0017); a guest order when left out. */
  readonly userId?: string;
};

export type InsertedOrder = { readonly id: string; readonly number: string };

/** A Palestinian mobile no other flow uses: `{ national, local, shown }`. */
export function uniquePhone() {
  const national = `59${String(Date.now() % 10_000_000).padStart(7, "0")}`;
  return {
    national,
    local: `0${national}`,
    shown: `0${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`,
  };
}

export async function insertOrder(sql: Sql, order: TestOrder = {}): Promise<InsertedOrder> {
  const fulfilment = order.fulfilment ?? "pickup";
  const national = order.national ?? "599123456";
  const placedAt = order.placedAt ?? new Date();
  return sql.begin(async (tx) => {
    const [variant] = await tx<{ id: string; product_id: string; price: number }[]>`
      select v.id, v.product_id, v.price from product_variants v
      join products p on p.id = v.product_id
      where p.status = 'active' order by p.code limit 1`;
    if (!variant) throw new Error("No product: run pnpm db:seed first");
    const [zone] =
      fulfilment === "delivery"
        ? await tx<{ id: string; name: string; fee: number }[]>`
            select id, name, fee from delivery_zones order by sort limit 1`
        : [null];
    const [{ year }] = await tx<{ year: number }[]>`
      select extract(year from (${placedAt}::timestamptz at time zone 'Asia/Hebron'))::int as year`;
    const [{ last_value: seq }] = await tx<{ last_value: number }[]>`
      insert into order_number_counters (year, last_value) values (${year}, 1)
      on conflict (year) do update set last_value = order_number_counters.last_value + 1
      returning last_value`;
    const number = `${String(year % 100).padStart(2, "0")}-${String(seq).padStart(5, "0")}`;
    const fee = zone?.fee ?? 0;
    const [{ id }] = await tx<{ id: string }[]>`
      insert into orders (
        order_number, placed_by_role, placed_by_user_id, customer_name, customer_phone,
        customer_phone_e164, fulfilment, delivery_zone_id, delivery_zone_name, delivery_fee, city, address,
        subtotal, total, status, placed_at
      ) values (
        ${number}, ${order.role ?? null}, ${order.userId ?? null},
        ${order.name ?? "زبون لوحة التحكم"}, ${`0${national}`}, ${`+970${national}`}, ${fulfilment}, ${zone?.id ?? null}, ${zone?.name ?? null}, ${fee},
        ${zone ? "نابلس" : null}, ${zone ? "شارع فيصل، بناية 12" : null},
        ${variant.price}, ${variant.price + fee}, ${order.status ?? "new"}, ${placedAt}
      ) returning id`;
    await tx`
      insert into order_lines (order_id, product_id, variant_id, product_name, product_code,
        quantity, catalog_unit_price, unit_price, line_total)
      values (${id}, ${variant.product_id}, ${variant.id}, 'ثريا لوحة التحكم', 'E2E-ORD',
        1, ${variant.price}, ${variant.price}, ${variant.price})`;
    await tx`
      insert into order_events (order_id, type, actor_kind, created_at)
      values (${id}, 'created', 'guest', ${placedAt})`;
    return { id, number };
  });
}

/** What the customer cancel writes (spec 0016 AC-4): a guest cancel whose event waits unseen. */
export async function cancelAsCustomer(sql: Sql, order: InsertedOrder) {
  await sql.begin(async (tx) => {
    const [{ status }] = await tx<{ status: string }[]>`
      select status from orders where id = ${order.id} for update`;
    await tx`
      update orders set status = 'cancelled', cancelled_at = now(), cancelled_by = 'guest'
      where id = ${order.id}`;
    await tx`
      insert into order_events (order_id, type, actor_kind, from_status, to_status)
      values (${order.id}, 'cancelled', 'guest', ${status}, 'cancelled')`;
  });
}

/** The amount the owner records as paid (spec 0016 AC-8: a paid order is cancelled on WhatsApp). */
export async function recordPayment(sql: Sql, order: InsertedOrder, amountPaid: number) {
  await sql`update orders set amount_paid = ${amountPaid} where id = ${order.id}`;
}
