// The dashboard order actions' input (spec 0014 AC-1, AC-3, AC-4, AC-13), parsed on the server.
import { z } from "zod";
import { tidiedText } from "@/lib/text-schemas";
import { ORDER_STATUSES, type WritableStatus } from "./status";

export const CANCEL_REASON_MAX = 300;
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

export const orderSearchSchema = z.object({ text: z.string().max(SEARCH_TEXT_MAX) });
