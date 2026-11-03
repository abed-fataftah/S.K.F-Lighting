import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/ltr";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListMore } from "@/features/catalog/components/list-results";
import { AccountHistory } from "@/features/customers/components/account-history";
import { CustomerOrdersTable } from "@/features/customers/components/customer-orders";
import { EditDetailsDialog } from "@/features/customers/components/edit-details-dialog";
import { RemovalPendingAlert } from "@/features/customers/components/removal-pending-alert";
import { RemoveCard } from "@/features/customers/components/remove-card";
import { RoleBadge } from "@/features/customers/components/role-badge";
import { RoleCard } from "@/features/customers/components/role-card";
import {
  getAdminCustomer,
  readAccountEvents,
  readCustomerOrders,
} from "@/features/customers/server/admin-queries";
import { myOrdersStep } from "@/features/orders/my-orders";
import { formatDate, formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { parsePage } from "@/lib/paging";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminCustomers");
  return { title: t("customerMeta") };
}

// One registered account (spec 0019 AC-4 to AC-7, AC-10 to AC-13): details, totals, every order,
// the role, and what the owner changed. A bad id, a missing profile, or an admin is not found. While
// a removal is pending, only the alert to finish it and the read only parts show.
export default async function AdminCustomerPage({
  params,
  searchParams,
}: PageProps<"/admin/customers/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [t, customer] = await Promise.all([
    getTranslations("AdminCustomers"),
    getAdminCustomer(id),
  ]);
  if (!customer) notFound();

  const page = parsePage(query.page);
  const [orders, events] = await Promise.all([
    readCustomerOrders(customer.id, page),
    readAccountEvents(customer.id),
  ]);
  const step = myOrdersStep(page, orders.rows.length, orders.total);
  const pending = customer.removalPending;

  const details: readonly (readonly [string, React.ReactNode])[] = [
    [t("name"), customer.fullName ?? "—"],
    [t("phone"), customer.phone ? <Ltr key="phone">{customer.phone}</Ltr> : "—"],
    [t("email"), customer.email ? <Ltr key="email">{customer.email}</Ltr> : "—"],
    [
      t("registeredAt"),
      <time key="registered" dateTime={customer.createdAt.toISOString()}>
        {formatDate(customer.createdAt)}
      </time>,
    ],
  ];

  const totals: readonly (readonly [string, string, string])[] = [
    ["orders", t("totalOrders"), formatNumber(customer.totals.orderCount)],
    ["spent", t("spent"), formatPrice(customer.totals.spent)],
    ["owed", t("owed"), formatPrice(customer.totals.owed)],
  ];

  return (
    <>
      {pending ? <RemovalPendingAlert profileId={customer.id} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex flex-wrap items-center gap-2 type-display-s">
          <span data-testid="customer-name">{customer.fullName ?? t("noName")}</span>
          <RoleBadge role={customer.role} data-testid="customer-header-role" />
        </h1>
        <div className="flex flex-wrap gap-2">
          {customer.phoneE164 ? (
            <ButtonLink
              variant="whatsapp"
              size="sm"
              href={whatsappUrl(
                customer.phoneE164,
                customer.fullName
                  ? t("contactMessage", { name: customer.fullName })
                  : t("contactMessageNoName"),
              )}
              target="_blank"
              rel="noopener"
              data-testid="customer-contact"
            >
              {t("contact")}
            </ButtonLink>
          ) : null}
          <ButtonLink variant="outline" render={<Link href={routes.admin.customers} />}>
            {t("backToCustomers")}
          </ButtonLink>
        </div>
      </div>

      <section aria-label={t("totalsLabel")} data-testid="customer-totals">
        <dl className="grid grid-cols-3 gap-2">
          {totals.map(([key, label, value]) => (
            <Card key={key} className="gap-1">
              <dt className="type-small text-muted">{label}</dt>
              <dd className="type-title-s" data-testid={`customer-total-${key}`}>
                <Ltr>{value}</Ltr>
              </dd>
            </Card>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[2_1_var(--admin-detail-main)] flex-col gap-3">
          <Card>
            <h2 className="type-title-s">{t("ordersCard")}</h2>
            {orders.rows.length === 0 ? (
              <p className="text-muted" data-testid="customer-orders-empty">
                {t("noOrders")}
              </p>
            ) : (
              <>
                <CustomerOrdersTable rows={orders.rows} />
                {step.hasMore || page > 1 ? (
                  <ListMore
                    shownText={t("shownOf", {
                      shown: formatNumber(orders.rows.length),
                      total: formatNumber(orders.total),
                    })}
                    moreText={t("more")}
                    moreHref={
                      step.hasMore
                        ? routes.admin.customerOrdersMore(
                            customer.id,
                            step.nextPage,
                            step.nextPosition,
                          )
                        : null
                    }
                    testId="customer-orders"
                  />
                ) : null}
              </>
            )}
          </Card>
          <AccountHistory events={events} />
        </section>

        <div className="flex min-w-0 flex-[1_1_var(--admin-detail-side)] flex-col gap-4">
          <Card data-testid="customer-details">
            <h2 className="type-title-s">{t("detailsCard")}</h2>
            <dl className="flex flex-col gap-2">
              {details.map(([label, value]) => (
                <div key={label} className="flex flex-col">
                  <dt className="type-small text-muted">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
            {pending ? null : (
              <EditDetailsDialog
                profileId={customer.id}
                name={customer.fullName}
                phone={customer.phone}
              />
            )}
          </Card>
          {pending ? null : (
            <>
              <RoleCard profileId={customer.id} name={customer.fullName} role={customer.role} />
              <RemoveCard profileId={customer.id} name={customer.fullName} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
