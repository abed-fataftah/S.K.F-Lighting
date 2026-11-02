import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

// My Orders with no orders yet (spec 0018 AC-6; docs/design/pages/my-orders.md layout item 3).
export function MyOrdersEmpty() {
  const t = useTranslations("MyOrders");

  return (
    <EmptyState
      title={t("emptyTitle")}
      text={t("emptyText")}
      actions={
        <ButtonLink size="lg" render={<Link href={routes.categories} />}>
          {t("emptyCta")}
        </ButtonLink>
      }
    />
  );
}
