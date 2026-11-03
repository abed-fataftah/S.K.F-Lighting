import { useTranslations } from "next-intl";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { AssignableRole } from "../roles";

// An account's role as a badge (spec 0019 AC-2, AC-4): عميل, or كهربائي in yellow so electricians
// stand out in the list. Works on the server and in the client search results.
export function RoleBadge({
  role,
  ...props
}: { readonly role: AssignableRole } & Omit<React.ComponentProps<typeof Badge>, "variant">) {
  const t = useTranslations("AdminCustomers");
  return (
    <Badge variant={role === "electrician" ? "new" : "proc"} data-role={role} {...props}>
      {t(`role.${role}`)}
    </Badge>
  );
}
