import { getTranslations } from "next-intl/server";
import { ORDER_STATUSES } from "@/features/orders/status";
import { CSV_COLUMNS, csvHeader, orderCsvRow, toCsv, type CsvLabels } from "@/features/reports/csv";
import { checkReportDays } from "@/features/reports/period";
import { exportOrdersInDb } from "@/features/reports/server/queries";
import { shopDateKey } from "@/lib/format";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";

// The period's orders as CSV (spec 0024 AC-9, AC-12). The admin check runs before any parameter
// is read; a refused caller goes to the report page, whose guard sends them to sign in and back.
// Logs carry the days and the row count, never a name, phone, or address.

const log = (event: string, fields: Readonly<Record<string, unknown>>) =>
  console.info(JSON.stringify({ event, ...fields }));

async function csvLabels(): Promise<CsvLabels> {
  const [t, orders] = await Promise.all([
    getTranslations("AdminReports"),
    getTranslations("AdminOrders"),
  ]);
  return {
    header: Object.fromEntries(CSV_COLUMNS.map((column) => [column, t(`csv.${column}`)])) as Record<
      (typeof CSV_COLUMNS)[number],
      string
    >,
    status: Object.fromEntries(
      ORDER_STATUSES.map((status) => [status, orders(`status.${status}`)]),
    ) as CsvLabels["status"],
    yes: t("csv.yes"),
    no: t("csv.no"),
    type: {
      customer: orders("typeCustomer"),
      electrician: orders("typeElectrician"),
      admin: t("csv.typeAdmin"),
      guest: t("csv.typeGuest"),
    },
    fulfilment: { delivery: t("csv.delivered"), pickup: t("csv.pickup") },
  };
}

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (!access.ok) {
    log("report_export_refused", { reason: "forbidden" });
    // A route handler's `redirect()` answers 307; the typed days are never echoed back.
    return new Response(null, { status: 303, headers: { Location: routes.admin.reports } });
  }

  const params = new URL(request.url).searchParams;
  const checked = checkReportDays(
    params.get("from") ?? undefined,
    params.get("to") ?? undefined,
    shopDateKey(new Date()),
  );
  if (!checked.ok) {
    log("report_export_refused", { reason: checked.code });
    return new Response(null, { status: 400 });
  }

  const { from, to } = checked.days;
  try {
    const [rows, labels] = await Promise.all([
      exportOrdersInDb(await getDb(), checked.days),
      csvLabels(),
    ]);
    const body = toCsv([csvHeader(labels), ...rows.map((row) => orderCsvRow(row, labels))]);
    log("report_exported", { from, to, rows: rows.length });
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="skf-sales-${from}-to-${to}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    // The route's error.tsx does not cover route handlers.
    log("report_export_failed", { from, to });
    return new Response(null, { status: 500 });
  }
}
