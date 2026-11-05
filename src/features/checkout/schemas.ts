// The checkout form (spec 0004 AC-6, spec 0012), shared by the form and `placeOrder`. A union on
// the method: a pickup order drops any zone, city, or address that was sent.
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { addressText, digitsField, personName, placeName, tidiedText } from "@/lib/text-schemas";

export const NAME_LIMITS = { min: 2, max: 80 } as const;
export const CITY_LIMITS = { min: 2, max: 60 } as const;
export const ADDRESS_LIMITS = { min: 5, max: 300 } as const;
export const NOTES_MAX = 500;

/** The phone as typed after cleaning (`customer_phone`) and its E.164 form (`customer_phone_e164`). */
export const phoneField = digitsField(
  (clean) => clean,
  z.string().transform((typed, ctx) => {
    const e164 = normalizePhone(typed);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: typed ? "phone_mobile" : "required" });
      return z.NEVER;
    }
    return { typed, e164 };
  }),
);

const shared = {
  idempotencyKey: z.guid(),
  name: personName(NAME_LIMITS),
  phone: phoneField,
  notes: tidiedText({ optional: true, max: NOTES_MAX, multiline: true }),
  // The total the summary showed, in agorot (AC-8).
  expectedTotal: z.coerce.number().int().min(0),
};

export const checkoutSchema = z.discriminatedUnion("fulfilment", [
  z.object({ ...shared, fulfilment: z.literal("pickup") }),
  z.object({
    ...shared,
    fulfilment: z.literal("delivery"),
    zoneId: z.guid({ error: "zone_required" }),
    city: placeName(CITY_LIMITS),
    address: addressText(ADDRESS_LIMITS),
  }),
]);

export type CheckoutInput = z.output<typeof checkoutSchema>;

/**
 * The hidden trap field (spec 0012 AC-8). People and screen readers never reach it, so a value
 * means a bot filled it. It is read before parsing and is not part of `checkoutSchema`.
 */
export const HONEYPOT_FIELD = "company_fax_2";

/** The order of the fields on the page, so focus can move to the first one in error. */
export const checkoutFieldOrder = [
  "name",
  "phone",
  "fulfilment",
  "zoneId",
  "city",
  "address",
  "notes",
] as const;
