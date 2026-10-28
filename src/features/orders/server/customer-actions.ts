"use server";

import { revalidatePath } from "next/cache";
import { readPlacedIds } from "@/features/checkout/server/placed";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { getDb } from "@/server/db";
import type { CustomerCancelError } from "../customer-cancel";
import { cancelOrderSchema } from "../schemas";
import { cancelOrderByCustomerInDb } from "./admin-status";
import { readTrackedIds } from "./tracked";

export type CancelOrderByCustomerResult =
  Ok<{ readonly status: "cancelled" }> | Fail<CustomerCancelError>;

/**
 * The customer's cancel from the order page (spec 0016 AC-4, AC-10). Only an order whose id this
 * browser holds in `skf_placed` or `skf_tracked` reaches the database. The reason travels in this
 * POST body and is stored on the order; it is never logged.
 */
export async function cancelOrderByCustomer(input: unknown): Promise<CancelOrderByCustomerResult> {
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const { orderId, from } = parsed.data;
  const [placed, tracked] = await Promise.all([readPlacedIds(), readTrackedIds()]);
  const id = orderId.toLowerCase();
  if (!placed.includes(id) && !tracked.includes(id)) return fail("not_found");

  const result = await cancelOrderByCustomerInDb(await getDb(), { ...parsed.data, orderId: id });
  if (!result.ok) return result;
  revalidatePath(routes.order(result.data.number));
  console.info(JSON.stringify({ event: "order_cancelled_by_customer", orderId: id, from }));
  return ok({ status: "cancelled" });
}
