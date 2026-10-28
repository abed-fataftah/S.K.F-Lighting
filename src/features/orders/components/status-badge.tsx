import { useTranslations } from "next-intl";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { statusBadgeVariant, type OrderStatus } from "../status";

// An order's status as a badge (spec 0014 AC-1): the word always, the variant from the status.
// Works on the server and in the client status card.
export function OrderStatusBadge({
  status,
  ...props
}: { readonly status: OrderStatus } & Omit<React.ComponentProps<typeof Badge>, "variant">) {
  const t = useTranslations("AdminOrders");
  return (
    <Badge variant={statusBadgeVariant(status)} data-status={status} {...props}>
      {t(`status.${status}`)}
    </Badge>
  );
}
