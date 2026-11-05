"use server";

import { revalidatePath } from "next/cache";
import { readPlacedIds } from "@/features/checkout/server/placed";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { getVerifiedUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import type { CustomerCancelError } from "../customer-cancel";
import { cancelOrderSchema } from "../schemas";
import { cancelOrderByCustomerInDb } from "./admin-status";
import { isOwnedOrder } from "./customer-order";
import { readTrackedIds } from "./tracked";

// A write, so the user comes from Supabase (a revoked session is refused at once). Called only when
// neither cookie holds the id; a guest costs no database call.
async function ownedBySession(orderId: string): Promise<boolean> {
  const userId = (await getVerifiedUser())?.id;
  return userId ? isOwnedOrder(await getDb(), orderId, userId) : false;
}

export type CancelOrderByCustomerResult =
  Ok<{ readonly status: "cancelled" }> | Fail<CustomerCancelError>;

/**
 * The customer's cancel from the order page (spec 0016 AC-4, AC-10). Only an order whose id this
 * browser holds in `skf_placed` or `skf_tracked`, or one the signed in account placed (spec 0017
 * AC-15), reaches the cancel write. The reason travels in this POST body and is stored on the
 * order; it is never logged.
 */
export async function cancelOrderByCustomer(input: unknown): Promise<CancelOrderByCustomerResult> {
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const { orderId, from } = parsed.data;
  const [placed, tracked] = await Promise.all([readPlacedIds(), readTrackedIds()]);
  const id = orderId.toLowerCase();
  if (!placed.includes(id) && !tracked.includes(id) && !(await ownedBySession(id))) {
    return fail("not_found");
  }

  const result = await cancelOrderByCustomerInDb(await getDb(), { ...parsed.data, orderId: id });
  if (!result.ok) return result;
  revalidatePath(routes.order(result.data.number));
  console.info(JSON.stringify({ event: "order_cancelled_by_customer", orderId: id, from }));
  return ok({ status: "cancelled" });
}
