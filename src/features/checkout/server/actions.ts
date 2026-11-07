"use server";

import { redirect } from "next/navigation";
import { reportError } from "@/server/monitoring/report";
import { tagSentryRole } from "@/server/monitoring/user";
import { getAccountProfile } from "@/features/accounts/server/profile";
import type { CartView } from "@/features/cart/cart-view";
import { readCartCookie } from "@/features/cart/server/cookies";
import { fieldErrorsOf, formValues, type FieldErrors } from "@/lib/form-errors";
import type { Fail } from "@/lib/result";
import { routes } from "@/lib/routes";
import { getDb } from "@/server/db";
import { checkoutSchema, HONEYPOT_FIELD } from "../schemas";
import type { DeliveryZoneOption } from "./checkout-options";
import { placeOrderInDb, type PlacedBy } from "./place-order";
import { rememberPlacedOrder } from "./placed";
import { orderRateCheck } from "./rate-limit";

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

/**
 * The account behind this submit (spec 0017 AC-13), read from the session now, never from the
 * form. Signed out, an expired session, or a user with no profile row places a guest order.
 */
async function readPlacedBy(): Promise<PlacedBy> {
  const account = await getAccountProfile();
  if (!account) return null;
  if (!account.profile) {
    console.warn(JSON.stringify({ event: "order_profile_missing", userId: account.userId }));
    return null;
  }
  if (account.profile.removalPending) {
    // The owner started removing this account (spec 0019 AC-12): nothing new links to it.
    console.warn(JSON.stringify({ event: "order_profile_removed", userId: account.userId }));
    return null;
  }
  tagSentryRole(account.profile.role);
  return { userId: account.userId, role: account.profile.role };
}

/** Place the order (spec 0004 AC-7 to AC-9): parse, check and save in one transaction, redirect. */
export async function placeOrder(_previous: CheckoutState, form: FormData): Promise<CheckoutState> {
  // Step 0: a filled trap saves nothing and costs no rate limit or database call (spec 0012 AC-8).
  const trap = form.get(HONEYPOT_FIELD);
  if (typeof trap === "string" && trap.trim() !== "") {
    console.warn(JSON.stringify({ event: "order_honeypot" }));
    return { ok: false, error: "save_failed" };
  }

  const parsed = checkoutSchema.safeParse(formValues(form));
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    logFailure("invalid", Object.keys(fieldErrors));
    return { ok: false, error: "invalid", fieldErrors };
  }

  // Step 2: every submission that parses counts, replays included (AC-10).
  if ((await orderRateCheck()) === "limited") {
    logFailure("rate_limited");
    return { ok: false, error: "rate_limited" };
  }

  let outcome: Awaited<ReturnType<typeof placeOrderInDb>>;
  try {
    outcome = await placeOrderInDb(await getDb(), {
      input: parsed.data,
      cart: await readCartCookie(),
      placedAt: new Date(),
      placedBy: await readPlacedBy(),
    });
  } catch (error) {
    // Unexpected, so it reaches Sentry and alerts (spec 0027 AC-11, AC-12). The refusals above
    // (invalid, rate limited, the trap, stock or price changes) are expected and never sent.
    await reportError("order_save_failed", error, {}, { area: "checkout" });
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
