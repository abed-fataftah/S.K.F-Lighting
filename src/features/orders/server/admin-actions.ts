"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { cancelOrderSchema, changeStatusSchema } from "../schemas";
import type { WritableStatus } from "../status";
import { cancelOrderInDb, changeOrderStatusInDb, type MoveError } from "./admin-status";

// The dashboard's order actions (spec 0014, API surface). Each runs `requireAdmin()` first, which
// checks the session with Supabase Auth, before anything is read or written (AC-17). Logs carry ids
// and statuses only, never a name, phone, reason, or search text.

const log = (event: string, fields: Readonly<Record<string, unknown>>) =>
  console.info(JSON.stringify({ event, ...fields }));

const refresh = (number: string) => {
  revalidatePath(routes.admin.orders);
  revalidatePath(routes.admin.order(number));
};

export type OrderMoveError = "forbidden" | "invalid" | MoveError;

export type ChangeOrderStatusResult =
  Ok<{ readonly status: WritableStatus }> | Fail<OrderMoveError>;

/** One status move from the status card (AC-3). */
export async function changeOrderStatus(input: unknown): Promise<ChangeOrderStatusResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const result = await changeOrderStatusInDb(await getDb(), admin.data.userId, parsed.data);
  if (!result.ok) return result;
  refresh(result.data.number);
  const { orderId, from, to } = parsed.data;
  log("order_status_changed", { orderId, from, to });
  return ok({ status: to });
}

export type CancelOrderResult = Ok<{ readonly status: "cancelled" }> | Fail<OrderMoveError>;

/** Cancel from the dialog (AC-4); the reason is stored on the order and never logged. */
export async function cancelOrderByAdmin(input: unknown): Promise<CancelOrderResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const result = await cancelOrderInDb(await getDb(), admin.data.userId, parsed.data);
  if (!result.ok) return result;
  refresh(result.data.number);
  log("order_cancelled", { orderId: parsed.data.orderId, from: parsed.data.from });
  return ok({ status: "cancelled" });
}
