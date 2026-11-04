// The dashboard order actions' input (spec 0014 AC-1, AC-3, AC-4, AC-13), the price save (spec 0022
// AC-3, AC-4), and the guest lookup form (spec 0015 AC-2, AC-3, AC-5), parsed on the server.
import { z } from "zod";
import { phoneField } from "@/features/checkout/schemas";
import { tidyText } from "@/lib/arabic";
import { parseShekels } from "@/lib/money";
import { digitsField, tidiedText } from "@/lib/text-schemas";
import { parseOrderNumberInput } from "./order-number";
import { ORDER_STATUSES, type WritableStatus } from "./status";

export const CANCEL_REASON_MAX = 300;
export const PRICE_NOTE_MAX = 200;
export const PRICE_LINES_MAX = 100;
export const SEARCH_TEXT_MAX = 40;

const anyStatus = z.enum(ORDER_STATUSES);
// `confirmed` is read like `new` but never written (AC-1).
const writableStatus = z.enum(
  ORDER_STATUSES.filter((status): status is WritableStatus => status !== "confirmed"),
);

export const changeStatusSchema = z.object({
  orderId: z.guid(),
  from: anyStatus,
  to: writableStatus,
});

export type ChangeStatusInput = z.output<typeof changeStatusSchema>;

export const cancelOrderSchema = z.object({
  orderId: z.guid(),
  from: anyStatus,
  // Blank after tidying is no reason: stored as null.
  reason: tidiedText({ optional: true, max: CANCEL_REASON_MAX, multiline: true }).transform(
    (reason) => reason ?? null,
  ),
});

export type CancelOrderInput = z.output<typeof cancelOrderSchema>;

/**
 * An adjusted unit price as typed (`١٢٫٥`, `0`, `1,250`) to integer agorot, 0 allowed (spec 0022
 * AC-3). Only `required` and `price_invalid`; the catalog cap needs the line, so it is checked apart.
 */
export const adjustedPriceField = digitsField(
  (clean) => (clean ? parseShekels(clean, { allowZero: true }) : undefined),
  z.number({ error: (issue) => (issue.input === undefined ? "required" : "price_invalid") }),
);

export const adjustPricesSchema = z.object({
  orderId: z.guid(),
  expectedTotal: z.number().int().min(0),
  note: tidiedText({ optional: true, max: PRICE_NOTE_MAX }),
  lines: z
    .array(
      z.object({
        lineId: z.guid(),
        expectedUnitPrice: z.number().int().min(0),
        price: adjustedPriceField,
      }),
    )
    .min(1)
    .max(PRICE_LINES_MAX)
    .refine((lines) => new Set(lines.map((line) => line.lineId)).size === lines.length),
});

export type AdjustPricesInput = z.output<typeof adjustPricesSchema>;

export const orderSearchSchema = z.object({ text: z.string().max(SEARCH_TEXT_MAX) });

/** A typed order number in its saved `YY-NNNNN` form; blank is `number_required`. */
const lookupNumber = z.string().transform((typed, ctx) => {
  if (tidyText(typed) === "") {
    ctx.addIssue({ code: "custom", message: "number_required" });
    return z.NEVER;
  }
  const number = parseOrderNumberInput(typed);
  if (!number) {
    ctx.addIssue({ code: "custom", message: "number_format" });
    return z.NEVER;
  }
  return number;
});

/** The lookup form: both halves must match one order (spec 0015 AC-3). */
export const orderLookupSchema = z.object({ number: lookupNumber, phone: phoneField });

export type OrderLookupInput = z.output<typeof orderLookupSchema>;

/** The lookup form fields in page order, for focusing the first error. */
export const orderLookupFieldOrder = ["number", "phone"] as const;
