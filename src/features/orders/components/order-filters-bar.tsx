import { useTranslations } from "next-intl";
import Link from "next/link";
import { ButtonLink, Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FilterChipLink } from "@/features/catalog/components/filter-chip-link";
import { formatDate, formatNumber, shopDayStart } from "@/lib/format";
import { routes } from "@/lib/routes";
import {
  hasOrderFilters,
  ORDER_METHODS,
  ORDER_RANGES,
  ORDER_TYPES,
  orderFiltersToParams,
  type OrderDays,
  type OrderFilters,
  type OrderRange,
} from "../admin-filters";
import { ORDER_STATUSES_SHOWN } from "../status";

const RANGE_KEYS: Readonly<Record<OrderRange, "rangeToday" | "range7d" | "rangeMonth">> = {
  today: "rangeToday",
  "7d": "range7d",
  month: "rangeMonth",
};

const TYPE_KEYS = { customer: "typeCustomer", electrician: "typeElectrician" } as const;

// The orders list filters (spec 0014 AC-9 to AC-12). Chips are plain links that change one filter
// and return to page 1; the selects and the date fields sit in one GET form that carries the
// chips' choice in hidden fields. No script: every view is an address you can bookmark.
export function OrderFiltersBar({
  filters,
  days,
}: {
  readonly filters: OrderFilters;
  readonly days: OrderDays;
}) {
  const t = useTranslations("AdminOrders");
  const href = (change: Partial<OrderFilters>) =>
    routes.admin.ordersWith({ ...filters, ...change }, 1);
  const custom = filters.from !== null || filters.to !== null;
  const dayLabel = (key: string) => formatDate(shopDayStart(key));
  const rangeLine =
    days.from && days.to
      ? t("rangeLine", { from: dayLabel(days.from), to: dayLabel(days.to) })
      : days.from
        ? t("rangeFrom", { from: dayLabel(days.from) })
        : days.to
          ? t("rangeUntil", { to: dayLabel(days.to) })
          : null;
  const filtered = hasOrderFilters(filters);

  return (
    <Card data-testid="order-filters">
      <h2 className="sr-only">{t("filtersLabel")}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label={t("statusFilter")} className="flex flex-wrap gap-2">
          <FilterChipLink href={href({ status: null })} current={filters.status === null}>
            {t("all")}
          </FilterChipLink>
          {ORDER_STATUSES_SHOWN.map((status) => (
            <FilterChipLink
              key={status}
              href={href({ status })}
              current={filters.status === status}
            >
              {t(`status.${status}`)}
            </FilterChipLink>
          ))}
        </nav>
        <FilterChipLink href={href({ unseen: !filters.unseen })} current={filters.unseen}>
          {t("unseenChip")}
        </FilterChipLink>
      </div>

      <nav aria-label={t("rangeFilter")} className="flex flex-wrap gap-2">
        {/* A preset drops the custom dates. */}
        <FilterChipLink
          href={href({ range: null, from: null, to: null })}
          current={filters.range === null && !custom}
        >
          {t("rangeAll")}
        </FilterChipLink>
        {ORDER_RANGES.map((range) => (
          <FilterChipLink
            key={range}
            href={href({ range, from: null, to: null })}
            current={filters.range === range}
          >
            {t(RANGE_KEYS[range], { days: formatNumber(7) })}
          </FilterChipLink>
        ))}
      </nav>

      {/* Keyed on the filters: a chip is a client navigation, and the uncontrolled fields must
          start again from the new values instead of keeping what was typed. */}
      <form
        key={orderFiltersToParams(filters, 1).toString()}
        method="get"
        action={routes.admin.orders}
        aria-label={t("filtersLabel")}
        className="flex flex-wrap items-end gap-3"
      >
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        {filters.unseen ? <input type="hidden" name="unseen" value="1" /> : null}
        <Field className="min-w-0 flex-[1_1_9rem]">
          <FieldLabel htmlFor="orders-type">{t("type")}</FieldLabel>
          <NativeSelect id="orders-type" name="type" defaultValue={filters.type ?? ""}>
            <NativeSelectOption value="">{t("all")}</NativeSelectOption>
            {ORDER_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {t(TYPE_KEYS[type])}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field className="min-w-0 flex-[1_1_11rem]">
          <FieldLabel htmlFor="orders-method">{t("method")}</FieldLabel>
          <NativeSelect id="orders-method" name="method" defaultValue={filters.method ?? ""}>
            <NativeSelectOption value="">{t("all")}</NativeSelectOption>
            {ORDER_METHODS.map((method) => (
              <NativeSelectOption key={method} value={method}>
                {t(method)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {/* The fields start on the days shown, so applying a select keeps a preset's days. */}
        <Field className="min-w-0 flex-[1_1_9rem]">
          <FieldLabel htmlFor="orders-from">{t("fromDay")}</FieldLabel>
          <Input id="orders-from" name="from" type="date" defaultValue={days.from ?? ""} />
        </Field>
        <Field className="min-w-0 flex-[1_1_9rem]">
          <FieldLabel htmlFor="orders-to">{t("toDay")}</FieldLabel>
          <Input id="orders-to" name="to" type="date" defaultValue={days.to ?? ""} />
        </Field>
        <Button type="submit" className="h-12" data-testid="orders-apply">
          {t("apply")}
        </Button>
      </form>

      {rangeLine || filtered ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {rangeLine ? <p data-testid="orders-range-line">{rangeLine}</p> : null}
          {filtered ? (
            <ButtonLink variant="link" render={<Link href={routes.admin.orders} />}>
              {t("clearFilters")}
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
