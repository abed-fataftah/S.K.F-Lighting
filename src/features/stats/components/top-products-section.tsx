import { Eye } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { StateCard } from "@/components/state-card";
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
import type { StatsPeriod } from "../period";
import type { SectionResult } from "../server/queries";
import type { TopProduct } from "../shape";
import { SectionError } from "./section-error";

// The most viewed products (spec 0027 AC-3): up to 10 by page views of their storefront page,
// each named and linked to that page, with a link to its editor.
export async function TopProductsSection({
  result,
  period,
}: {
  readonly result: Promise<SectionResult<readonly TopProduct[]>>;
  readonly period: StatsPeriod;
}) {
  const [t, products] = await Promise.all([getTranslations("Stats"), result]);
  if (!products.ok) {
    return (
      <SectionError
        title={t("topProducts")}
        retryHref={routes.admin.stats(period.preset)}
        testId="stats-products-error"
      />
    );
  }

  return (
    <section
      className="flex min-w-0 flex-[1_1_22rem] flex-col gap-3"
      aria-labelledby="stats-products-title"
      data-testid="stats-products"
    >
      <h2 id="stats-products-title" className="type-lead">
        {t("topProducts")}
      </h2>
      {products.data.length === 0 ? (
        <StateCard icon={Eye} title={t("productsEmpty")} data-testid="stats-products-empty" />
      ) : (
        <Table aria-labelledby="stats-products-title">
          <TableHeader>
            <TableRow>
              <TableHead>{t("product")}</TableHead>
              <TableHead>{t("views")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.data.map((product) => (
              <TableRow key={product.id} data-testid="stats-product-row">
                <TableCell>
                  <Link
                    href={routes.product(product.slug)}
                    className="inline-flex min-h-11 items-center font-extrabold underline"
                  >
                    {product.name}
                  </Link>
                </TableCell>
                <TableCell>{formatNumber(product.pageViews)}</TableCell>
                <TableCell>
                  <Link
                    href={routes.admin.product(product.id)}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center underline"
                    aria-label={t("editProduct", { name: product.name })}
                  >
                    {t("edit")}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
