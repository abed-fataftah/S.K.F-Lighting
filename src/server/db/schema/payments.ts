import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";
import { paymentKind, paymentMethod } from "./enums";
import { orders } from "./orders";
import { profiles } from "./profiles";

// The money ledger of an order (spec 0023): every payment, refund, and reversal is a new row, and
// `orders.amount_paid` is its running sum, written by the same transaction. The id is the client's
// `paymentId` or `reversalId`, so a retried request writes nothing new. Append only: triggers in
// migration 0014 refuse update, delete, and truncate. Cheque details and the note are owner only.
export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    kind: paymentKind("kind").notNull(),
    // A reversal copies its target's method and cheque fields.
    method: paymentMethod("method").notNull(),
    amount: integer("amount").notNull(),
    // The shop day the money changed hands (a reversal: the shop day it was recorded).
    receivedOn: date("received_on").notNull(),
    chequeNumber: text("cheque_number"),
    chequeBank: text("cheque_bank"),
    // The date written on the cheque.
    chequeDueDate: date("cheque_due_date"),
    reversesPaymentId: uuid("reverses_payment_id"),
    note: text("note"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    ...timestamps(),
  },
  (t) => [
    index("payments_order_id_idx").on(t.orderId),
    index("payments_recorded_by_idx").on(t.recordedBy),
    uniqueIndex("payments_reverses_payment_id_unique").on(t.reversesPaymentId),
    foreignKey({
      name: "payments_reverses_payment_id_fk",
      columns: [t.reversesPaymentId],
      foreignColumns: [t.id],
    }).onDelete("restrict"),
    check("payments_amount_check", sql`${t.amount} > 0`),
    check(
      "payments_cheque_check",
      sql`(${t.method} = 'cheque' and num_nonnulls(${t.chequeNumber}, ${t.chequeBank}, ${t.chequeDueDate}) = 3) or (${t.method} = 'cash' and num_nulls(${t.chequeNumber}, ${t.chequeBank}, ${t.chequeDueDate}) = 3)`,
    ),
    check(
      "payments_reversal_check",
      sql`(${t.kind} = 'reversal') = (${t.reversesPaymentId} is not null)`,
    ),
    check(
      "payments_reversal_note_check",
      sql`${t.kind} <> 'reversal' or (${t.note} is not null and btrim(${t.note}) <> '')`,
    ),
    check(
      "payments_not_self_check",
      sql`${t.reversesPaymentId} is null or ${t.reversesPaymentId} <> ${t.id}`,
    ),
  ],
).enableRLS();
