import { CircleCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StateCard } from "@/components/state-card";
import { ButtonLink } from "@/components/ui/button";
import { CustomerSearch } from "@/features/customers/components/customer-search";
import { CustomersTable } from "@/features/customers/components/customers-table";
import {
  CUSTOMER_SEARCH_LIMIT,
  listAdminCustomers,
} from "@/features/customers/server/admin-queries";
import { formatNumber } from "@/lib/format";
import { parsePage } from "@/lib/paging";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminCustomers");
  return { title: t("metaTitle") };
}

// The customers list (spec 0019 AC-2, AC-3): every registered customer and electrician, newest
// first, 50 a page; the owner's own admin account never shows. Search replaces the table.
export default async function AdminCustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const query = await searchParams;
  const page = parsePage(query.page);
  const [t, { rows, hasNext }] = await Promise.all([
    getTranslations("AdminCustomers"),
    listAdminCustomers(page),
  ]);
  if (rows.length === 0 && page > 1) redirect(routes.admin.customers);

  return (
    <>
      <h1 className="type-display-s">{t("title")}</h1>
      {query.notice === "removed" ? (
        <p
          role="status"
          className="flex items-center gap-2 font-bold"
          data-testid="customer-removed"
        >
          <CircleCheck aria-hidden className="size-5.5 shrink-0" />
          {t("removedNotice")}
        </p>
      ) : null}
      <CustomerSearch limit={CUSTOMER_SEARCH_LIMIT}>
        {rows.length === 0 ? (
          <StateCard icon={Users} title={t("empty")} data-testid="customers-empty" />
        ) : (
          <CustomersTable rows={rows} label={t("tableLabel")} />
        )}
        {page > 1 || hasNext ? (
          <nav aria-label={t("pages")} className="flex flex-wrap items-center gap-3">
            {page > 1 ? (
              <ButtonLink
                variant="outline"
                render={<Link href={routes.admin.customersPage(page - 1)} />}
              >
                {t("previous")}
              </ButtonLink>
            ) : null}
            <span className="text-muted">{t("page", { shown: formatNumber(page) })}</span>
            {hasNext ? (
              <ButtonLink
                variant="outline"
                render={<Link href={routes.admin.customersPage(page + 1)} />}
              >
                {t("next")}
              </ButtonLink>
            ) : null}
          </nav>
        ) : null}
      </CustomerSearch>
    </>
  );
}
