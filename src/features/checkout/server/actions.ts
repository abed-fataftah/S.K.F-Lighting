"use server";

import { redirect } from "next/navigation";
import type { CartView } from "@/features/cart/cart-view";
import { readCartCookie } from "@/features/cart/server/cookies";
import { fieldErrorsOf, formValues, type FieldErrors } from "@/lib/form-errors";
import type { Fail } from "@/lib/result";
import { routes } from "@/lib/routes";
import { getDb } from "@/server/db";
import { checkoutSchema } from "../schemas";
import type { DeliveryZoneOption } from "./checkout-options";
import { placeOrderInDb } from "./place-order";
import { rememberPlacedOrder } from "./placed";

export type CheckoutError =
  | "invalid"
  | "rate_limited"
  | "cart_empty"
  | "not_sellable"
  | "zone_invalid"
  | "price_changed"
  | "save_failed";

/** What the form gets back on a failure; a success redirects instead. Null before the first submit. */
export type CheckoutState = Fail<
  CheckoutError,
  {
    readonly fieldErrors?: FieldErrors;
    /** The fresh cart and zones after `price_changed`, `not_sellable`, or `zone_invalid` (AC-8). */
    readonly cart?: CartView;
    readonly zones?: readonly DeliveryZoneOption[];
  }
> | null;

// Logs carry the error code and field names only, never what the customer typed (AC-15).
function logFailure(error: CheckoutError, fields: readonly string[] = []) {
  console.warn(JSON.stringify({ event: "order_refused", error, fields }));
}

/** Place the order (spec 0004 AC-7 to AC-9): parse, check and save in one transaction, redirect. */
export async function placeOrder(_previous: CheckoutState, form: FormData): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse(formValues(form));
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    logFailure("invalid", Object.keys(fieldErrors));
    return { ok: false, error: "invalid", fieldErrors };
  }

  let outcome: Awaited<ReturnType<typeof placeOrderInDb>>;
  try {
    outcome = await placeOrderInDb(await getDb(), {
      input: parsed.data,
      cart: await readCartCookie(),
      placedAt: new Date(),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "order_failed",
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return { ok: false, error: "save_failed" };
  }

  switch (outcome.kind) {
    case "cart_empty":
      logFailure(outcome.kind);
      return { ok: false, error: outcome.kind };
    case "not_sellable":
    case "zone_invalid":
    case "price_changed":
      logFailure(outcome.kind);
      return { ok: false, error: outcome.kind, cart: outcome.cart, zones: outcome.zones };
    case "placed":
      console.info(
        JSON.stringify({
          event: "order_placed",
          orderNumber: outcome.orderNumber,
          lineCount: outcome.lineCount,
          total: outcome.total,
        }),
      );
      break;
    case "replayed":
      break;
  }

  // Cookies set before the redirect travel with it; redirect stays outside any try.
  await rememberPlacedOrder(outcome.orderId);
  redirect(`${routes.checkoutDone(outcome.orderNumber)}?wa=1`);
}
