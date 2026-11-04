// Inputs of the draft Server Actions (spec 0020), shared by the page and the actions. While
// drafting, the customer fields are only tidied and cut to the checkout maximums; the full
// checkout rules run on send (AC-10, AC-13).
import { z } from "zod";
import { ADDRESS_LIMITS, CITY_LIMITS, NAME_LIMITS, NOTES_MAX } from "@/features/checkout/schemas";
import { tidyText } from "@/lib/arabic";
import { normalizePhone } from "@/lib/phone";
import { tidiedText } from "@/lib/text-schemas";
import { DRAFT_MAX_QUANTITY } from "./quantity";

export const MAX_DRAFTS = 30;
export const MAX_DRAFT_LINES = 30;
export const DRAFT_NAME_LIMITS = { min: 2, max: 40 } as const;
export const PHONE_MAX = 30;

/** The draft name (AC-4): one tidied line of 2 to 40 characters. */
export const draftNameSchema = tidiedText(DRAFT_NAME_LIMITS);

/** `too_short` or `too_long`, the two ways a name is `invalid` (AC-4 messages). */
export type DraftNameProblem = "too_short" | "too_long";

export function draftNameProblem(error: z.ZodError): DraftNameProblem {
  return error.issues.some((issue) => issue.message === "too_long") ? "too_long" : "too_short";
}

const draftId = z.guid();

export const createDraftSchema = z.object({ name: draftNameSchema });
export const renameDraftSchema = z.object({ draftId, name: draftNameSchema });
export const draftIdSchema = z.object({ draftId });
export const lineIdSchema = z.object({ lineId: z.guid() });

const quantity = z.number().int().min(1).max(DRAFT_MAX_QUANTITY).nullable();

/** One line change (AC-8): the product with its option, the option alone, or the quantity. */
export const updateDraftLineSchema = z.union([
  z.object({ lineId: z.guid(), productId: z.guid(), variantId: z.guid().nullable() }).strict(),
  z.object({ lineId: z.guid(), variantId: z.guid() }).strict(),
  z.object({ lineId: z.guid(), quantity }).strict(),
]);

export type UpdateDraftLineInput = z.output<typeof updateDraftLineSchema>;

/** Undo of a removed line (AC-9): it comes back with what it held, in its old place. */
export const restoreDraftLineSchema = z.object({
  draftId,
  productId: z.guid().nullable(),
  variantId: z.guid().nullable(),
  quantity,
  sort: z.number().int().min(0).max(1_000_000),
});

export type RestoreDraftLineInput = z.output<typeof restoreDraftLineSchema>;

/** Cuts to `max` code points, so a pasted wall of text still saves its start. */
const cut = (text: string, max: number) => Array.from(text).slice(0, max).join("");

/** Tidied and cut; blank saves null. */
const draftText = (max: number, multiline = false) =>
  z.string().transform((text) => cut(tidyText(text, { multiline }), max) || null);

/** The customer card (AC-10): any subset of the fields, each saved as typed after tidying. */
export const draftCustomerSchema = z
  .object({
    draftId,
    customerName: draftText(NAME_LIMITS.max),
    customerPhone: draftText(PHONE_MAX),
    fulfilment: z.enum(["pickup", "delivery"]).nullable(),
    deliveryZoneId: z.guid().nullable(),
    city: draftText(CITY_LIMITS.max),
    address: draftText(ADDRESS_LIMITS.max, true),
    notes: draftText(NOTES_MAX, true),
  })
  .partial()
  .required({ draftId: true });

export type DraftCustomerInput = z.output<typeof draftCustomerSchema>;

/** The columns a customer save writes: the given fields, plus the E.164 form with the phone. */
export function draftCustomerColumns(input: DraftCustomerInput) {
  const fields = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== "draftId"),
  ) as Omit<DraftCustomerInput, "draftId">;
  if (fields.customerPhone === undefined) return fields;
  const customerPhoneE164 = fields.customerPhone ? normalizePhone(fields.customerPhone) : null;
  return { ...fields, customerPhoneE164 };
}

/** `readDraftPicker` (spec 0021 API surface). */
export const draftPickerSchema = z.object({ productId: z.guid() });

/** `addToDraft` (spec 0021 AC-8, AC-9): into one of the user's drafts, or a new named one. */
export const addToDraftSchema = z.object({
  productId: z.guid(),
  variantId: z.guid(),
  quantity: z.number().int().min(1).max(DRAFT_MAX_QUANTITY),
  target: z.union([
    z.object({ draftId }).strict(),
    z.object({ newDraftName: draftNameSchema }).strict(),
  ]),
});

export type AddToDraftInput = z.output<typeof addToDraftSchema>;

/** The name problem of a refused `addToDraft`, set only when a new draft name fails (AC-8). */
export function addToDraftNameProblem(input: unknown): DraftNameProblem | undefined {
  const target = (input as { target?: { newDraftName?: unknown } } | null)?.target;
  if (!target || typeof target !== "object" || !("newDraftName" in target)) return undefined;
  const parsed = draftNameSchema.safeParse(target.newDraftName);
  return parsed.success ? undefined : draftNameProblem(parsed.error);
}

export const sendDraftSchema = z.object({ draftId, expectedTotal: z.number().int().min(0) });
