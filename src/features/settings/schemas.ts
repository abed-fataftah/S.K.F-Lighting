// The settings hub's inputs (spec 0025, AC-2, AC-5, AC-10), checked by the same schemas in the
// browser and in the actions. Number fields accept Arabic digits; free text is tidied (spec 0005).
import { z } from "zod";
import { ADDRESS_LIMITS } from "@/features/checkout/schemas";
import { policySlugs } from "@/features/policies/slugs";
import { tidyText, toWesternDigits } from "@/lib/arabic";
import { addressText, tidiedText } from "@/lib/text-schemas";

export const ZONE_LIMIT = 10;
export const ZONE_NAME = { max: 40 } as const;
export const ZONE_SHORT_NAME = { max: 12 } as const;
export const MAX_FEE_SHEKELS = 500;
export const POLICY_TITLE = { max: 80 } as const;
export const POLICY_BODY = { max: 20_000 } as const;

// What people put between digits: spaces, a leading plus, dashes, and brackets.
const PHONE_SEPARATORS = /[\s+\-()]/g;
const WHATSAPP_DIGITS = /^[1-9]\d{7,14}$/;
const PHONE_CHARACTERS = /^[\d\s+\-()]+$/;

const clean = (text: string) => toWesternDigits(tidyText(text));

export type WhatsappError = "whatsapp_required" | "whatsapp_country_code" | "whatsapp_invalid";

/**
 * The WhatsApp number as digits with the country code (AC-2), checked in this order: empty,
 * stripped to digits, a leading 0, then 8 to 15 digits starting with 1 to 9.
 * `"+970 599-123-456"` and `"٩٧٠٥٩٩١٢٣٤٥٦"` both give `"970599123456"`.
 */
export function normalizeWhatsapp(
  text: string,
):
  | { readonly ok: true; readonly digits: string }
  | { readonly ok: false; readonly error: WhatsappError } {
  const tidied = clean(text);
  if (!tidied) return { ok: false, error: "whatsapp_required" };
  const digits = tidied.replace(PHONE_SEPARATORS, "");
  if (digits.startsWith("0")) return { ok: false, error: "whatsapp_country_code" };
  return WHATSAPP_DIGITS.test(digits)
    ? { ok: true, digits }
    : { ok: false, error: "whatsapp_invalid" };
}

/**
 * The shop's phone (AC-2), stored as typed after tidying with Western digits: only digits and
 * separators, 7 to 15 digits once stripped. Blank is `null`; anything else that fails is `"invalid"`.
 */
export function normalizeShopPhone(text: string): string | null | "invalid" {
  const tidied = clean(text);
  if (!tidied) return null;
  const digits = tidied.replace(PHONE_SEPARATORS, "").length;
  return PHONE_CHARACTERS.test(tidied) && digits >= 7 && digits <= 15 ? tidied : "invalid";
}

/** A zone fee typed in whole shekels, 0 to 500 (AC-5), as agorot; anything else is null. */
export function parseFeeShekels(text: string): number | null {
  const tidied = clean(text);
  if (!/^\d{1,3}$/.test(tidied)) return null;
  const shekels = Number(tidied);
  return shekels <= MAX_FEE_SHEKELS ? shekels * 100 : null;
}

/** A required tidied text whose empty case says `code` instead of the generic length message. */
const requiredText = (max: number, code: string, multiline = false) =>
  tidiedText({ min: 0, max, multiline }).refine((text) => text.length > 0, { message: code });

export const shopContactSchema = z.object({
  whatsappNumber: z.string().transform((text, ctx) => {
    const result = normalizeWhatsapp(text);
    if (result.ok) return result.digits;
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }),
  contactPhone: z
    .string()
    .optional()
    .transform((text, ctx) => {
      const phone = normalizeShopPhone(text ?? "");
      if (phone !== "invalid") return phone;
      ctx.addIssue({ code: "custom", message: "phone_invalid" });
      return z.NEVER;
    }),
  // Blank saves as null; anything typed follows the checkout address rule (spec 0012 AC-4).
  address: z
    .string()
    .optional()
    .transform((text) => tidyText(text ?? "") || null)
    .pipe(addressText(ADDRESS_LIMITS).nullable()),
});

export type ShopContactInput = z.input<typeof shopContactSchema>;
export type ShopContactData = z.output<typeof shopContactSchema>;

const zoneFields = z.object({
  name: requiredText(ZONE_NAME.max, "required"),
  shortName: requiredText(ZONE_SHORT_NAME.max, "required"),
  feeShekels: z.string().transform((text, ctx) => {
    const fee = parseFeeShekels(text);
    if (fee !== null) return fee;
    ctx.addIssue({ code: "custom", message: "fee_invalid" });
    return z.NEVER;
  }),
});

const zoneId = z.guid().transform((value) => value.toLowerCase());

/** A new zone; `feeShekels` comes out as `fee` in agorot. */
export const addZoneSchema = zoneFields.transform(({ feeShekels, ...zone }) => ({
  ...zone,
  fee: feeShekels,
}));

export const saveZoneSchema = zoneFields
  .extend({ id: zoneId })
  .transform(({ feeShekels, ...zone }) => ({ ...zone, fee: feeShekels }));

export type ZoneInput = z.input<typeof addZoneSchema>;
export type ZoneData = z.output<typeof addZoneSchema>;
export type SaveZoneData = z.output<typeof saveZoneSchema>;

export const setZoneActiveSchema = z.object({ id: zoneId, isActive: z.boolean() });

export const savePolicySchema = z.object({
  slug: z.enum(policySlugs),
  title: requiredText(POLICY_TITLE.max, "title_required"),
  body: requiredText(POLICY_BODY.max, "body_required", true),
  // The page's `version` when the editor loaded it (AC-11).
  version: z.number().int().min(0),
});

export type SavePolicyInput = z.input<typeof savePolicySchema>;
export type SavePolicyData = z.output<typeof savePolicySchema>;
