import { PackageSearch, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Ltr } from "@/components/ltr";
import { StateCard } from "@/components/state-card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PRODUCT_FILTERS,
  listPrice,
  optionCounts,
  parseCategoryFilter,
  parseProductFilter,
  parseSearch,
  statusBadge,
} from "@/features/catalog/admin-list";
import { FilterChipLink } from "@/features/catalog/components/filter-chip-link";
import { getEditorLookups, listAdminProducts } from "@/features/catalog/server/admin-queries";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { parsePage } from "@/lib/paging";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminProducts");
  return { title: t("metaTitle") };
}

// The products list (spec 0006 AC-1; docs/design/pages/admin-products.md). Search, category, and
// status live in the address and combine; 50 a page, newest first. The import button comes with
// feature 8, which builds the page it opens.
export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const params = await searchParams;
  const filters = {
    q: parseSearch(params.q),
    categoryId: parseCategoryFilter(params.categoryId),
    filter: parseProductFilter(params.filter),
    page: parsePage(params.page),
  };
  const [t, { rows, hasNext }, lookups] = await Promise.all([
    getTranslations("AdminProducts"),
    listAdminProducts(filters),
    getEditorLookups(routes.admin.productsList(filters)),
  ]);
  const filtered = !!filters.q || !!filters.categoryId || filters.filter !== "all";
  const href = (patch: Partial<typeof filters>) =>
    routes.admin.productsList({ ...filters, page: 1, ...patch });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display-s">{t("title")}</h1>
        <ButtonLink render={<Link href={routes.admin.productNew} />} data-testid="product-add">
          {t("add")}
        </ButtonLink>
      </div>

      <Card>
        <form
          method="get"
          action={routes.admin.products}
          role="search"
          aria-label={t("filtersLabel")}
          className="flex flex-wrap items-end gap-3"
        >
          {filters.filter !== "all" ? (
            <input type="hidden" name="filter" value={filters.filter} />
          ) : null}
          <Field className="min-w-0 flex-[2_1_14rem]">
            <FieldLabel htmlFor="products-q">{t("search")}</FieldLabel>
            <Input
              id="products-q"
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              placeholder={t("searchPlaceholder")}
              autoComplete="off"
              maxLength={120}
            />
          </Field>
          <Field className="min-w-0 flex-[1_1_12rem]">
            <FieldLabel htmlFor="products-category">{t("category")}</FieldLabel>
            <NativeSelect
              id="products-category"
              name="categoryId"
              defaultValue={filters.categoryId ?? ""}
            >
              <NativeSelectOption value="">{t("allCategories")}</NativeSelectOption>
              {lookups.categories.map((main) =>
                main.children.length ? (
                  <NativeSelectOptGroup key={main.id} label={main.name}>
                    <NativeSelectOption value={main.id}>{main.name}</NativeSelectOption>
                    {main.children.map((sub) => (
                      <NativeSelectOption key={sub.id} value={sub.id}>
                        {`${main.name} › ${sub.name}`}
                      </NativeSelectOption>
                    ))}
                  </NativeSelectOptGroup>
                ) : (
                  <NativeSelectOption key={main.id} value={main.id}>
                    {main.name}
                  </NativeSelectOption>
                ),
              )}
            </NativeSelect>
          </Field>
          <Button type="submit" size="sm" className="h-12">
            {t("searchSubmit")}
          </Button>
        </form>
        <nav aria-label={t("statusLabel")} className="flex flex-wrap gap-2">
          {PRODUCT_FILTERS.map((filter) => (
            <FilterChipLink
              key={filter}
              href={href({ filter })}
              current={filters.filter === filter}
            >
              {t(`filters.${filter}`)}
            </FilterChipLink>
          ))}
        </nav>
      </Card>

      {rows.length === 0 ? (
        filtered || filters.page > 1 ? (
          <StateCard
            icon={SearchX}
            title={t("noMatchTitle")}
            text={t("noMatchText")}
            actions={
              <ButtonLink variant="outline" render={<Link href={routes.admin.products} />}>
                {t("clearFilters")}
              </ButtonLink>
            }
          />
        ) : (
          <StateCard
            icon={PackageSearch}
            title={t("emptyTitle")}
            text={t("emptyText")}
            actions={
              <ButtonLink render={<Link href={routes.admin.productNew} />}>{t("add")}</ButtonLink>
            }
          />
        )
      ) : (
        <Table aria-label={t("tableLabel")} data-testid="admin-products">
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="sr-only">{t("photo")}</span>
              </TableHead>
              <TableHead>{t("product")}</TableHead>
              <TableHead>{t("code")}</TableHead>
              <TableHead>{t("category")}</TableHead>
              <TableHead>{t("price")}</TableHead>
              <TableHead>{t("options")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("action")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((product) => {
              const price = listPrice(product.minPrice, product.maxPrice);
              return (
                <TableRow key={product.id} data-testid={`product-row-${product.code}`}>
                  <TableCell>
                    {product.mainImageKey ? (
                      <Image
                        src={product.mainImageKey}
                        alt=""
                        width={44}
                        height={44}
                        className="size-(--size-tile-table) rounded-btn bg-product-1 object-cover"
                      />
                    ) : (
                      <ImagePlaceholder className="size-(--size-tile-table) rounded-btn [&_svg]:size-6" />
                    )}
                  </TableCell>
                  <TableCell className="min-w-40">
                    <Link
                      href={routes.admin.product(product.id)}
                      className="inline-flex min-h-11 items-center font-extrabold underline"
                    >
                      {product.name}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Ltr>{product.code}</Ltr>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {product.categoryPath.join(" › ")}
                  </TableCell>
                  <TableCell className="whitespace-nowrap" data-testid="product-price">
                    {price
                      ? price.from
                        ? t("from", { price: formatPrice(price.amount) })
                        : formatPrice(price.amount)
                      : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap" data-testid="product-options">
                    {optionCounts(product.sizeCount, product.colourCount)
                      .map(({ kind, count }) =>
                        t(kind === "sizes" ? "sizesCount" : "coloursCount", {
                          count,
                          shown: formatNumber(count),
                        }),
                      )
                      .join(" · ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadge[product.status]} data-testid="product-status">
                      {t(`filters.${product.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ButtonLink
                      variant="outline"
                      render={<Link href={routes.admin.product(product.id)} />}
                      aria-label={t("editLabel", { name: product.name })}
                    >
                      {t("edit")}
                    </ButtonLink>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {filters.page > 1 || hasNext ? (
        <nav aria-label={t("pages")} className="flex flex-wrap items-center gap-3">
          {filters.page > 1 ? (
            <ButtonLink variant="outline" render={<Link href={href({ page: filters.page - 1 })} />}>
              {t("previous")}
            </ButtonLink>
          ) : null}
          <span className="text-muted">{t("page", { shown: formatNumber(filters.page) })}</span>
          {hasNext ? (
            <ButtonLink variant="outline" render={<Link href={href({ page: filters.page + 1 })} />}>
              {t("next")}
            </ButtonLink>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
