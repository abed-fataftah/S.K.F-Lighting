"use client";

import { useTranslations } from "next-intl";
import type { FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  filtersOf,
  instantFilters,
  listAction,
  listHref,
  type FiltersScope,
} from "../filters-form";
import { EMPTY_FILTERS, type FilterChoices, type ListFilters } from "../list-filters";
import { FilterFields, useFiltersForm } from "./filter-fields";

// The desktop filter column (spec 0029 AC-10): from lg, beside the grid of a category or search
// page, always open, with the filters screen's controls. A chip or the switch applies at once,
// without scrolling, and the column stays mounted, so focus stays on that control; the price
// waits for "تطبيق" or Enter. Without JavaScript it is a GET form to the list's own address, and
// "تطبيق" submits all of it. "مسح الكل" is a plain link to the unfiltered list.
export function FiltersPanel({
  scope,
  choices,
  applied,
  className,
}: {
  readonly scope: FiltersScope;
  readonly choices: FilterChoices;
  /** The resolved filters, in address form. */
  readonly applied: ListFilters;
  readonly className?: string;
}) {
  const t = useTranslations("Filters");
  const router = useRouter();
  const [form, setForm] = useFiltersForm(applied);

  const go = (filters: ListFilters) => router.push(listHref(scope, filters), { scroll: false });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    go(filtersOf(form));
  };

  return (
    <form
      action={listAction(scope)}
      method="get"
      onSubmit={submit}
      aria-label={t("title")}
      className={cn("flex flex-col gap-3", className)}
      data-testid="filters-panel"
    >
      {scope.kind === "search" ? <input type="hidden" name="q" value={scope.q} /> : null}
      <FilterFields
        choices={choices}
        form={form}
        onChange={(next, instant) => {
          setForm(next);
          if (instant) go(instantFilters(next, applied));
        }}
        priceAction={
          <Button type="submit" variant="outline" data-testid="filters-panel-price">
            {t("applyPrice")}
          </Button>
        }
      />
      <ButtonLink
        variant="outline"
        render={<Link href={listHref(scope, EMPTY_FILTERS)} scroll={false} />}
      >
        {t("clearAll")}
      </ButtonLink>
    </form>
  );
}
