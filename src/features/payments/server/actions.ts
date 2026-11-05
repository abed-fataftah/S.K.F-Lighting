"use server";

import { revalidatePath } from "next/cache";
import { shopDateKey } from "@/lib/format";
import { fail, ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import {
  paymentFieldErrors,
  paymentSchema,
  reversalSchema,
  type RecordPaymentResult,
  type ReversePaymentResult,
} from "../schemas";
import { recordPaymentInDb, reversePaymentInDb, type Written } from "./record";

// Recording and reversing money on the dashboard order page (spec 0023 AC-4, AC-6, AC-7, AC-15).
// `requireAdmin()` checks the session with Supabase Auth before anything is read or written; each
// action takes one `now` for "today" on the shop's clock. Logs carry ids, kinds, methods, amounts,
// and error codes, never the note, the reason, or a cheque's number or bank.

const log = (event: string, fields: Readonly<Record<string, unknown>>) =>
  console.info(JSON.stringify({ event, ...fields }));

const orderIdOf = (input: unknown) =>
  typeof input === "object" && input !== null && "orderId" in input ? input.orderId : undefined;

function refused<R extends { readonly ok: false; readonly error: string }>(
  input: unknown,
  result: R,
): R {
  log("payment_refused", { orderId: orderIdOf(input), error: result.error });
  return result;
}

function landed(orderId: string, written: Written) {
  const { number, kind, method, amount, fromPaid, amountPaid, duplicate } = written;
  revalidatePath(routes.admin.order(number));
  revalidatePath(routes.admin.orders);
  revalidatePath(routes.order(number));
  revalidatePath(routes.accountOrders);
  log("payment_recorded", {
    orderId,
    kind,
    method,
    amount,
    fromPaid,
    toPaid: amountPaid,
    duplicate,
  });
  return ok({ amountPaid, duplicate });
}

export async function recordPayment(input: unknown): Promise<RecordPaymentResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return refused(input, fail("forbidden"));
  const today = shopDateKey(new Date());
  const parsed = paymentSchema({ today }).safeParse(input);
  if (!parsed.success) {
    return refused(input, { ...fail("invalid"), fieldErrors: paymentFieldErrors(parsed.error) });
  }

  const result = await recordPaymentInDb(await getDb(), admin.data.userId, parsed.data, today);
  if (!result.ok) return refused(input, result);
  return landed(parsed.data.orderId, result.data);
}

export async function reversePayment(input: unknown): Promise<ReversePaymentResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return refused(input, fail("forbidden"));
  const parsed = reversalSchema.safeParse(input);
  if (!parsed.success) {
    return refused(input, { ...fail("invalid"), fieldErrors: paymentFieldErrors(parsed.error) });
  }

  const today = shopDateKey(new Date());
  const result = await reversePaymentInDb(await getDb(), admin.data.userId, parsed.data, today);
  if (!result.ok) return refused(input, result);
  return landed(parsed.data.orderId, result.data);
}
