// The payment form and the reversal dialog (spec 0023 AC-3, AC-4, AC-6, AC-7): one schema factory
// the browser and the Server Action share, the typed results, and which notice each refusal shows.
import { z } from "zod";
import { tidyText, toWesternDigits } from "@/lib/arabic";
import { isDateKey } from "@/lib/format";
import { parseShekels } from "@/lib/money";
import type { Fail, Ok } from "@/lib/result";
import { digitsField, tidiedText } from "@/lib/text-schemas";
import { PAYMENT_METHODS, type PaymentMethod, type RecordKind } from "./ledger";

export const PAYMENT_NOTE_MAX = 200;
export const REVERSAL_REASON_MAX = 200;
export const CHEQUE_NUMBER_MAX = 30;
export const CHEQUE_BANK_MAX = 60;

/** The form fields in page order, for focusing the first error. */
export const PAYMENT_FIELDS = [
  "amount",
  "chequeNumber",
  "chequeBank",
  "chequeDueDate",
  "receivedOn",
  "note",
] as const;
export type PaymentField = (typeof PAYMENT_FIELDS)[number] | "reason";

/** Why a field was refused; the form shows one message per field and code. */
export type PaymentFieldError =
  "required" | "amount_invalid" | "too_much" | "too_long" | "date_future" | "before_order";

export type PaymentFieldErrors = Readonly<Partial<Record<PaymentField, PaymentFieldError>>>;

const chequeNumberField = digitsField((clean) => clean, tidiedText({ max: CHEQUE_NUMBER_MAX }));
const chequeBankField = tidiedText({ max: CHEQUE_BANK_MAX });
const noteField = tidiedText({ max: PAYMENT_NOTE_MAX });

type Checked = { readonly value: string } | { readonly error: "required" | "too_long" };

/** A tidied text check's outcome as a field code: blank is `required`. */
function checkText(schema: z.ZodType<string, string>, text: string | undefined): Checked {
  const parsed = schema.safeParse(text ?? "");
  if (parsed.success) return { value: parsed.data };
  return { error: parsed.error.issues[0]?.message === "too_long" ? "too_long" : "required" };
}

const dayKey = (text: string | undefined) => toWesternDigits(tidyText(text ?? ""));

export type Cheque = {
  readonly number: string;
  readonly bank: string;
  /** `YYYY-MM-DD`, the date written on the cheque: any real day, past or future. */
  readonly dueDate: string;
};

export type PaymentInput = {
  readonly paymentId: string;
  readonly orderId: string;
  readonly kind: RecordKind;
  readonly expectedAmountPaid: number;
  readonly amount: number;
  readonly method: PaymentMethod;
  /** Set exactly when `method` is `cheque`; cash drops whatever the cheque fields held. */
  readonly cheque: Cheque | null;
  readonly receivedOn: string;
  readonly note: string | undefined;
};

type Errors = Partial<Record<PaymentField, PaymentFieldError>>;

function readCheque(raw: {
  readonly chequeNumber?: string;
  readonly chequeBank?: string;
  readonly chequeDueDate?: string;
}): { readonly cheque: Cheque | null; readonly errors: Errors } {
  const number = checkText(chequeNumberField, raw.chequeNumber);
  const bank = checkText(chequeBankField, raw.chequeBank);
  const dueDate = dayKey(raw.chequeDueDate);
  const errors: Errors = {
    ...("error" in number ? { chequeNumber: number.error } : {}),
    ...("error" in bank ? { chequeBank: bank.error } : {}),
    ...(isDateKey(dueDate) ? {} : { chequeDueDate: "required" as const }),
  };
  return "value" in number && "value" in bank && isDateKey(dueDate)
    ? { cheque: { number: number.value, bank: bank.value, dueDate }, errors }
    : { cheque: null, errors };
}

function amountError(
  text: string,
  amount: number | null,
  limit: number | undefined,
): PaymentFieldError | null {
  if (!text) return "required";
  if (amount === null) return "amount_invalid";
  return limit !== undefined && amount > limit ? "too_much" : null;
}

function dayError(
  day: string,
  today: string,
  minDay: string | undefined,
): PaymentFieldError | null {
  if (!isDateKey(day)) return "required";
  if (day > today) return "date_future";
  return minDay && day < minDay ? "before_order" : null;
}

/**
 * The payment form. The server passes only `today` (its one `now`, on the shop's clock) and checks
 * the limit and the order's first day under the lock; the browser also passes `limit` and `minDay`
 * from the page so it can mark every problem before sending anything.
 */
export function paymentSchema(options: {
  readonly today: string;
  readonly minDay?: string;
  readonly limit?: number;
}) {
  return z
    .object({
      paymentId: z.guid(),
      orderId: z.guid(),
      kind: z.enum(["payment", "refund"]),
      expectedAmountPaid: z.number().int().min(0),
      amount: z.string(),
      method: z.enum(PAYMENT_METHODS),
      receivedOn: z.string(),
      chequeNumber: z.string().optional(),
      chequeBank: z.string().optional(),
      chequeDueDate: z.string().optional(),
      note: z.string().optional(),
    })
    .transform((raw, ctx): PaymentInput => {
      const amountText = toWesternDigits(tidyText(raw.amount));
      const amount = amountText ? parseShekels(amountText) : null;
      const cheque = raw.method === "cheque" ? readCheque(raw) : { cheque: null, errors: {} };
      const receivedOn = dayKey(raw.receivedOn);
      const blankNote = tidyText(raw.note ?? "") === "";
      const note = blankNote ? null : checkText(noteField, raw.note);

      const amountProblem = amountError(amountText, amount, options.limit);
      const dayProblem = dayError(receivedOn, options.today, options.minDay);
      const errors: Errors = {
        ...(amountProblem ? { amount: amountProblem } : {}),
        ...cheque.errors,
        ...(dayProblem ? { receivedOn: dayProblem } : {}),
        ...(note && "error" in note ? { note: "too_long" as const } : {}),
      };
      for (const [field, code] of Object.entries(errors)) {
        ctx.addIssue({ code: "custom", path: [field], message: code });
      }
      if (Object.keys(errors).length > 0 || amount === null) return z.NEVER;
      return {
        paymentId: raw.paymentId,
        orderId: raw.orderId,
        kind: raw.kind,
        expectedAmountPaid: raw.expectedAmountPaid,
        amount,
        method: raw.method,
        cheque: cheque.cheque,
        receivedOn,
        note: note && "value" in note ? note.value : undefined,
      };
    });
}

export const reversalSchema = z.object({
  reversalId: z.guid(),
  orderId: z.guid(),
  paymentId: z.guid(),
  expectedAmountPaid: z.number().int().min(0),
  reason: tidiedText({ max: REVERSAL_REASON_MAX }),
});

export type ReversalInput = z.output<typeof reversalSchema>;

const FIELD_ERRORS: readonly string[] = [
  "required",
  "amount_invalid",
  "too_much",
  "too_long",
  "date_future",
  "before_order",
] satisfies readonly PaymentFieldError[];

const isField = (field: string): field is PaymentField =>
  field === "reason" || (PAYMENT_FIELDS as readonly string[]).includes(field);

/** The first problem of each field, from a failed parse of either schema. */
export function paymentFieldErrors(error: z.ZodError): PaymentFieldErrors {
  return error.issues.reduce<Errors>((found, issue) => {
    const field = issue.path[0];
    if (typeof field !== "string" || !isField(field) || found[field]) return found;
    const code = FIELD_ERRORS.includes(issue.message)
      ? (issue.message as PaymentFieldError)
      : "required";
    return { ...found, [field]: code };
  }, {});
}

// Results (AC-7). `invalid` carries the fields; `too_much` the limit read under the lock.

export type Recorded = { readonly amountPaid: number; readonly duplicate: boolean };

type Invalid = Fail<"invalid", { readonly fieldErrors: PaymentFieldErrors }>;

export type RecordFail =
  | Fail<"not_found" | "not_allowed" | "stale">
  | Fail<"too_much", { readonly limit: number }>
  | Invalid;

export type ReverseFail = Fail<
  "not_found" | "is_reversal" | "already_reversed" | "stale" | "out_of_range"
>;

export type RecordPaymentResult = Ok<Recorded> | Fail<"forbidden"> | RecordFail;
export type ReversePaymentResult = Ok<Recorded> | Fail<"forbidden"> | Invalid | ReverseFail;

export type PaymentError =
  | Exclude<RecordPaymentResult, Ok<Recorded>>["error"]
  | Exclude<ReversePaymentResult, Ok<Recorded>>["error"];

/** The notice a refusal shows (an `AdminPayments.errors` key) and whether the page refreshes. */
export type PaymentNotice = {
  readonly key: "notFound" | "notAllowed" | "stale" | "reversed" | "outOfRange" | "failed";
  readonly refresh: boolean;
};

/**
 * AC-7: `forbidden` refreshes so the layout sends the browser to sign in; field errors and
 * `too_much` show under their fields; everything else is one notice. A notice that refreshes drops
 * the typed values; `failed` keeps them.
 */
export function paymentNotice(error: PaymentError, hasFieldErrors: boolean): PaymentNotice | null {
  switch (error) {
    case "forbidden":
    case "too_much":
      return null;
    case "invalid":
      return hasFieldErrors ? null : { key: "failed", refresh: false };
    case "not_found":
      return { key: "notFound", refresh: true };
    case "not_allowed":
      return { key: "notAllowed", refresh: true };
    case "stale":
      return { key: "stale", refresh: true };
    case "is_reversal":
    case "already_reversed":
      return { key: "reversed", refresh: true };
    case "out_of_range":
      return { key: "outOfRange", refresh: false };
  }
}

export type FieldMessageKey =
  | "amountRequired"
  | "amountInvalid"
  | "amountTooMuchPayment"
  | "amountTooMuchRefund"
  | "chequeNumberRequired"
  | "chequeBankRequired"
  | "chequeDueDateRequired"
  | "dateRequired"
  | "dateFuture"
  | "dateBeforeOrder"
  | "tooLong"
  | "reasonRequired";

/** The `AdminPayments.errors` message for a field's problem (AC-3, AC-6). */
export function fieldMessageKey(
  field: PaymentField,
  code: PaymentFieldError,
  kind: RecordKind,
): FieldMessageKey {
  if (code === "too_long") return "tooLong";
  switch (field) {
    case "amount":
      if (code === "required") return "amountRequired";
      if (code !== "too_much") return "amountInvalid";
      return kind === "payment" ? "amountTooMuchPayment" : "amountTooMuchRefund";
    case "chequeNumber":
      return "chequeNumberRequired";
    case "chequeBank":
      return "chequeBankRequired";
    case "chequeDueDate":
      return "chequeDueDateRequired";
    case "receivedOn":
      if (code === "date_future") return "dateFuture";
      return code === "before_order" ? "dateBeforeOrder" : "dateRequired";
    case "note":
      return "tooLong";
    case "reason":
      return "reasonRequired";
  }
}
