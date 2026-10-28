"use server";

import { redirect } from "next/navigation";
import { fieldErrorsOf, formValues, type FieldErrors } from "@/lib/form-errors";
import type { Fail } from "@/lib/result";
import { routes } from "@/lib/routes";
import { getDb } from "@/server/db";
import { orderLookupSchema } from "../schemas";
import { findLookupOrderId } from "./customer-order";
import { rememberTrackedOrder } from "./tracked";

export type LookupError = "invalid" | "not_found" | "limited";

/** What the form gets back on a failure; a match redirects instead. Null before the first submit. */
export type LookupState = Fail<
  LookupError,
  {
    readonly fieldErrors?: FieldErrors;
    /** The raw strings as typed, so the fields keep them after React resets the form (AC-5). */
    readonly values: { readonly number: string; readonly phone: string };
  }
> | null;

const typed = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

/**
 * The guest lookup (spec 0015 AC-3 to AC-5): parse, match the number and E.164 phone in one
 * query, then remember the order in `skf_tracked` and open its page. A wrong number, a wrong
 * phone, and an unknown number all get the same `not_found`. Nothing typed is ever logged.
 */
export async function lookupOrder(_previous: LookupState, form: FormData): Promise<LookupState> {
  const values = { number: typed(form, "number"), phone: typed(form, "phone") };

  const parsed = orderLookupSchema.safeParse(formValues(form));
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error), values };
  }
  const { number, phone } = parsed.data;

  const id = await findLookupOrderId(await getDb(), number, phone.e164);
  if (!id) return { ok: false, error: "not_found", values };

  // The cookie set before the redirect travels with it; redirect stays outside any try.
  await rememberTrackedOrder(id);
  redirect(routes.order(number));
}
