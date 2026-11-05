import "server-only";
import { asc, eq } from "drizzle-orm";
import { payments } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { PaymentRow } from "../ledger";

/**
 * Every ledger row of one order, oldest first (spec 0023 AC-1). For the dashboard order page only:
 * cheque details and notes are owner only and no storefront path selects them.
 */
export function readOrderPayments(
  db: Database | Transaction,
  orderId: string,
): Promise<readonly PaymentRow[]> {
  return db
    .select({
      id: payments.id,
      kind: payments.kind,
      method: payments.method,
      amount: payments.amount,
      receivedOn: payments.receivedOn,
      chequeNumber: payments.chequeNumber,
      chequeBank: payments.chequeBank,
      chequeDueDate: payments.chequeDueDate,
      note: payments.note,
      reversesPaymentId: payments.reversesPaymentId,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(asc(payments.receivedOn), asc(payments.createdAt));
}
