import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { ListMore } from "@/features/catalog/components/list-results";
import { MyOrderCard } from "@/features/orders/components/my-order-card";
import { MyOrdersEmpty } from "@/features/orders/components/my-orders-empty";
import { myOrdersStep } from "@/features/orders/my-orders";
import { readMyOrders } from "@/features/orders/server/my-orders";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { parsePage } from "@/lib/paging";
import { routes } from "@/lib/routes";
import { getClaims } from "@/server/auth/session";
import { getDb } from "@/server/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("myOrders"), robots: { index: false } };
}

// My Orders (spec 0018; docs/design/pages/my-orders.md): every order this account placed, newest
// first, 20 per step. The account comes only from the session; a signed out visitor goes to sign
// in and comes back here. A database failure throws to the shared error card.
export default async function MyOrdersPage({
  searchParams,
}: PageProps<"/[locale]/account/orders">) {
  const [claims, query, t] = await Promise.all([
    getClaims(),
    searchParams,
    getTranslations("MyOrders"),
  ]);
  if (!claims?.sub) redirect(routes.signInWith({ next: routes.accountOrders }));

  const page = parsePage(query.page);
  const { rows, total } = await readMyOrders(await getDb(), claims.sub, page);
  const step = myOrdersStep(page, rows.length, total);

  return (
    <div className="flex flex-col gap-2.5 px-(--page-pad) pt-3 pb-8">
      <div className="flex flex-col items-start gap-1 pb-1">
        <h1 className="type-title-l">{t("title")}</h1>
        <ButtonLink
          variant="outline"
          render={<Link href={routes.account} />}
          data-testid="profile-link"
        >
          {t("profileLink")}
        </ButtonLink>
      </div>
      {rows.length === 0 ? (
        <MyOrdersEmpty />
      ) : (
        <>
          <ol className="flex flex-col gap-2.5" data-testid="my-orders">
            {rows.map((order) => (
              <li key={order.number}>
                <MyOrderCard order={order} />
              </li>
            ))}
          </ol>
          {step.hasMore ? (
            <ListMore
              shownText={t("shownOf", {
                shown: formatNumber(rows.length),
                total: formatNumber(total),
              })}
              moreText={t("more")}
              moreHref={routes.accountOrdersMore(step.nextPage, step.nextPosition)}
              testId="my-orders"
            />
          ) : null}
        </>
      )}
    </div>
  );
}
