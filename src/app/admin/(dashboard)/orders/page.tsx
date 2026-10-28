import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StateCard } from "@/components/state-card";
import { ButtonLink } from "@/components/ui/button";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { listAdminOrders } from "@/features/orders/server/admin-queries";
import { formatNumber } from "@/lib/format";
import { parsePage } from "@/lib/paging";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminOrders");
  return { title: t("metaTitle") };
}

// The orders list (spec 0004 AC-13; docs/design/pages/admin-orders.md, without the filters and
// the status and payment columns, which come with feature 15). Newest first, 50 a page.
export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const page = parsePage((await searchParams).page);
  const [t, { rows, hasNext }] = await Promise.all([
    getTranslations("AdminOrders"),
    listAdminOrders(page),
  ]);

  return (
    <>
      <h1 className="type-display-s">{t("title")}</h1>
      {rows.length === 0 ? (
        <StateCard icon={Inbox} title={t("emptyTitle")} text={t("emptyText")} />
      ) : (
        <>
          <OrdersTable rows={rows} label={t("tableLabel")} />
          <p className="type-small text-muted">{t("newNote")}</p>
        </>
      )}
      {page > 1 || hasNext ? (
        <nav aria-label={t("pages")} className="flex flex-wrap items-center gap-3">
          {page > 1 ? (
            <ButtonLink
              variant="outline"
              render={<Link href={routes.admin.ordersPage(page - 1)} />}
            >
              {t("previous")}
            </ButtonLink>
          ) : null}
          <span className="text-muted">{t("page", { shown: formatNumber(page) })}</span>
          {hasNext ? (
            <ButtonLink
              variant="outline"
              render={<Link href={routes.admin.ordersPage(page + 1)} />}
            >
              {t("next")}
            </ButtonLink>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
