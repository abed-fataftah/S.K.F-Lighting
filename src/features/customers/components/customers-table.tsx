import { useTranslations } from "next-intl";
import Link from "next/link";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { AdminCustomerRow } from "../server/admin-queries";
import { RoleBadge } from "./role-badge";

// The customers table (spec 0019 AC-2), shared by the server rendered list and the client search
// results, so it holds no server code. A pending removal shows no name or phone, and a marker.
export function CustomersTable({
  rows,
  label,
  testId = "admin-customers",
}: {
  readonly rows: readonly AdminCustomerRow[];
  readonly label: string;
  readonly testId?: string;
}) {
  const t = useTranslations("AdminCustomers");

  return (
    <Table aria-label={label} data-testid={testId}>
      <TableHeader>
        <TableRow>
          <TableHead>{t("name")}</TableHead>
          <TableHead>{t("phone")}</TableHead>
          <TableHead>{t("roleColumn")}</TableHead>
          <TableHead>{t("orders")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((customer) => {
          const name = customer.removalPending ? null : customer.fullName;
          const phone = customer.removalPending ? null : customer.phone;
          return (
            <TableRow key={customer.id} data-testid={`customer-row-${customer.id}`}>
              <TableCell>
                <Link
                  href={routes.admin.customer(customer.id)}
                  className="inline-flex min-h-11 min-w-11 items-center font-extrabold underline"
                  aria-label={name ? undefined : t("noName")}
                >
                  {name ?? "—"}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {phone ? <Ltr>{phone}</Ltr> : "—"}
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap items-center gap-1.5">
                  <RoleBadge role={customer.role} />
                  {customer.removalPending ? (
                    <Badge variant="off" data-testid="customer-removal-pending">
                      {t("removalPendingBadge")}
                    </Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell>{formatNumber(customer.orderCount)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
