// The period's orders as a spreadsheet (spec 0024 AC-9). Pure: a byte order mark first so Excel
// reads the Arabic, CRLF line ends, RFC 4180 quoting, and money as plain shekels a spreadsheet can
// sum. Text cells that would start a formula get a leading `'`. Never a phone, address, or note.
import { formatTime, shopDateKey } from "@/lib/format";
import { toShekelsInput } from "@/lib/money";
import type { OrderStatus } from "@/features/orders/status";
import type { ExportOrder } from "./server/queries";

export const CSV_COLUMNS = [
  "orderNumber",
  "date",
  "time",
  "status",
  "counted",
  "type",
  "name",
  "fulfilment",
  "subtotal",
  "discount",
  "delivery",
  "total",
  "paid",
  "remaining",
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** Every text the file writes, from `AdminReports.csv.*` and the orders list's status labels. */
export type CsvLabels = {
  readonly header: Readonly<Record<CsvColumn, string>>;
  readonly status: Readonly<Record<OrderStatus, string>>;
  readonly yes: string;
  readonly no: string;
  readonly type: Readonly<Record<"customer" | "electrician" | "admin" | "guest", string>>;
  readonly fulfilment: Readonly<Record<"delivery" | "pickup", string>>;
};

// After any leading spaces: = + - @, a tab, or a carriage return.
const FORMULA_LEAD = /^ *[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;

/** One cell, quoted when needed; a text cell (never money) is guarded against formulas. */
export function csvCell(value: string, kind: "text" | "money" = "text"): string {
  const safe = kind === "text" && FORMULA_LEAD.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The whole file: BOM, then each row of cells already made by `csvCell`, every line ending CRLF. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return `\uFEFF${rows.map((row) => `${row.join(",")}\r\n`).join("")}`;
}

export function csvHeader(labels: CsvLabels): string[] {
  return CSV_COLUMNS.map((column) => csvCell(labels.header[column]));
}

const money = (agorot: number) => csvCell(toShekelsInput(agorot), "money");

/** One order's row in `CSV_COLUMNS` order. */
export function orderCsvRow(order: ExportOrder, labels: CsvLabels): string[] {
  const counted = order.status !== "cancelled";
  return [
    csvCell(order.orderNumber),
    csvCell(shopDateKey(order.placedAt)),
    csvCell(formatTime(order.placedAt)),
    csvCell(labels.status[order.status]),
    csvCell(counted ? labels.yes : labels.no),
    csvCell(labels.type[order.placedByRole ?? "guest"]),
    csvCell(order.customerName),
    csvCell(labels.fulfilment[order.fulfilment]),
    money(order.subtotal),
    money(order.discountTotal),
    money(order.deliveryFee),
    money(order.total),
    money(order.amountPaid),
    // A cancelled order owes nothing more.
    counted ? money(order.total - order.amountPaid) : "",
  ];
}
