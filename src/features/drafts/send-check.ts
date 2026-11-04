// The customer card checked as checkout checks it (spec 0020 AC-13), shared by the page before
// it sends and by `sendDraftInDb`. Pure.
import { checkoutSchema } from "@/features/checkout/schemas";
import { fieldErrorsOf, type FieldErrors } from "@/lib/form-errors";
import type { SendError } from "./server/actions";

export type DraftCustomerFields = {
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly fulfilment: "pickup" | "delivery" | null;
  readonly deliveryZoneId: string | null;
  readonly city: string | null;
  readonly address: string | null;
  readonly notes: string | null;
};

/**
 * The checkout schema over the draft's columns, every null as `""`, so an empty field gets the
 * error checkout gives it. With no fulfilment chosen, the rest is checked as pickup and the method
 * itself is `required`.
 */
export function parseDraftCustomer(
  draft: DraftCustomerFields,
  draftId: string,
  expectedTotal: number,
) {
  const raw = {
    idempotencyKey: draftId,
    expectedTotal,
    name: draft.customerName ?? "",
    phone: draft.customerPhone ?? "",
    fulfilment: draft.fulfilment ?? "pickup",
    zoneId: draft.deliveryZoneId ?? "",
    city: draft.city ?? "",
    address: draft.address ?? "",
    notes: draft.notes ?? "",
  };
  const parsed = checkoutSchema.safeParse(raw);
  const fieldErrors: FieldErrors = parsed.success ? {} : fieldErrorsOf(parsed.error);
  if (draft.fulfilment === null) {
    return {
      ok: false as const,
      fieldErrors: { ...fieldErrors, fulfilment: { code: "required" as const } } as FieldErrors,
    };
  }
  return parsed.success
    ? { ok: true as const, input: parsed.data }
    : { ok: false as const, fieldErrors };
}

/** Why sending stopped: the server's refusal, or a check the page made first (AC-9, AC-13). */
export type SendNotice = SendError | "save_first" | "restore_failed";

type ShownRefusal =
  | "price_changed"
  | "not_sellable"
  | "zone_invalid"
  | "empty"
  | "rate_limited"
  | "invalid"
  | "incomplete";

/** The `QuickOrder` message for a notice at the top of the totals card (AC-13). */
export function sendNoticeKey(
  notice: SendNotice,
): "saveFirst" | "restoreFailed" | `sendErrors.${ShownRefusal}` | "sendErrors.failed" {
  switch (notice) {
    case "save_first":
      return "saveFirst";
    case "restore_failed":
      return "restoreFailed";
    case "price_changed":
    case "not_sellable":
    case "zone_invalid":
    case "empty":
    case "rate_limited":
    case "invalid":
    case "incomplete":
      return `sendErrors.${notice}`;
    default:
      return "sendErrors.failed";
  }
}
