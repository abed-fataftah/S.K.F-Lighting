"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { lineErrorsFromIssues, type AdjustedPriceError } from "../price-adjust";
import { adjustPricesSchema } from "../schemas";
import { adjustOrderPricesInDb, type AdjustFail } from "./price-adjust";

// The price save from the dashboard order page (spec 0022 AC-4, AC-6, AC-11). `requireAdmin()`
// checks the session with Supabase Auth before anything is read or written. Logs carry ids, counts,
// totals, and the error code, never the note.

const log = (event: string, fields: Readonly<Record<string, unknown>>) =>
  console.info(JSON.stringify({ event, ...fields }));

const orderIdOf = (input: unknown) =>
  typeof input === "object" && input !== null && "orderId" in input ? input.orderId : undefined;

export type AdjustOrderPricesResult =
  | Ok<{
      readonly subtotal: number;
      readonly total: number;
      readonly lines: readonly {
        readonly lineId: string;
        readonly unitPrice: number;
        readonly lineTotal: number;
      }[];
    }>
  | Fail<"forbidden">
  | Fail<"invalid", { readonly lineErrors?: Readonly<Record<string, AdjustedPriceError>> }>
  | AdjustFail;

export async function adjustOrderPrices(input: unknown): Promise<AdjustOrderPricesResult> {
  const refused = <R extends AdjustOrderPricesResult & { readonly ok: false }>(result: R): R => {
    log("order_prices_refused", { orderId: orderIdOf(input), error: result.error });
    return result;
  };

  const admin = await requireAdmin();
  if (!admin.ok) return refused(fail("forbidden"));
  const parsed = adjustPricesSchema.safeParse(input);
  if (!parsed.success) {
    const lineErrors = lineErrorsFromIssues(input, parsed.error.issues);
    return refused(lineErrors ? { ...fail("invalid"), lineErrors } : fail("invalid"));
  }

  const result = await adjustOrderPricesInDb(await getDb(), admin.data.userId, parsed.data);
  if (!result.ok) return refused(result);
  const { number, subtotal, total, fromTotal, lineCount, lines } = result.data;
  revalidatePath(routes.admin.order(number));
  revalidatePath(routes.admin.orders);
  revalidatePath(routes.order(number));
  log("order_prices_adjusted", {
    orderId: parsed.data.orderId,
    lineCount,
    fromTotal,
    toTotal: total,
  });
  return ok({ subtotal, total, lines });
}
