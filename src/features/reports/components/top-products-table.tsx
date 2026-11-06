import { useTranslations } from "next-intl";
import Link from "next/link";
import { Ltr } from "@/components/ltr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";
import type { TopProduct } from "../server/queries";

// The best sellers (spec 0024 AC-7): up to 10 products by quantity, each under its current name
// and linked to its editor. Line totals leave out order discounts and delivery, so the note says
// they do not add up to total sales.
export function TopProductsTable({ products }: { readonly products: readonly TopProduct[] }) {
  const t = useTranslations("AdminReports");

  return (
    <section
      className="flex min-w-0 flex-[1_1_22rem] flex-col gap-3"
      aria-labelledby="reports-top-title"
      data-testid="reports-top-products"
    >
      <h2 id="reports-top-title" className="type-lead">
        {t("topProducts")}
      </h2>
      <Table aria-label={t("topProducts")}>
        <TableHeader>
          <TableRow>
            <TableHead>{t("product")}</TableHead>
            <TableHead>{t("quantity")}</TableHead>
            <TableHead>{t("productSales")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.productId}>
              <TableCell>
                <Link
                  href={routes.admin.product(product.productId)}
                  className="inline-flex min-h-11 items-center font-extrabold underline"
                >
                  {product.name}
                </Link>{" "}
                <span className="type-small text-muted">
                  <Ltr>{product.code}</Ltr>
                </span>
              </TableCell>
              <TableCell>{formatNumber(product.quantity)}</TableCell>
              <TableCell className="whitespace-nowrap">
                <Ltr>{formatPrice(product.sales)}</Ltr>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="type-small text-muted">{t("topProductsNote")}</p>
    </section>
  );
}
