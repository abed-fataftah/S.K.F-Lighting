import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/money";
import {
  appliedChips,
  EMPTY_FILTERS,
  toListFilters,
  withoutChip,
  type AppliedChip,
  type ListFilters,
  type ResolvedFilters,
} from "../list-filters";
import { RemoveChipLink } from "./remove-chip-link";

// The applied filters row (spec 0010 AC-13; pages/category.md item 6): one removable chip per
// size, colour, price, and "available", each a link to the address without it, then "clear all".
// The links land on `#filters`, so focus goes back to the filter button.

const shekels = (whole: number) => formatPrice(whole * 100);

type Translate = Awaited<ReturnType<typeof getTranslations<"Filters">>>;

function chipText(chip: AppliedChip, t: Translate): string {
  switch (chip.kind) {
    case "size":
      return chip.label;
    case "colour":
      return chip.name;
    case "available":
      return t("available");
    case "price":
      if (chip.min !== null && chip.max !== null) {
        return t("chipPrice", { min: shekels(chip.min), max: shekels(chip.max) });
      }
      return chip.min !== null
        ? t("chipPriceFrom", { min: shekels(chip.min) })
        : t("chipPriceTo", { max: shekels(chip.max!) });
  }
}

const chipKey = (chip: AppliedChip) =>
  chip.kind === "size" ? `s:${chip.key}` : chip.kind === "colour" ? `c:${chip.name}` : chip.kind;

export async function AppliedChips({
  filters,
  hrefFor,
}: {
  readonly filters: ResolvedFilters;
  /** The list's address with these filters (page 1). */
  readonly hrefFor: (filters: ListFilters) => string;
}) {
  const t = await getTranslations("Filters");
  const current = toListFilters(filters);
  const chips = appliedChips(filters);
  if (!chips.length) return null;

  return (
    <div
      role="group"
      aria-label={t("appliedLabel")}
      className="flex flex-wrap items-center gap-2"
      data-testid="applied-chips"
    >
      {chips.map((chip) => {
        const label = chipText(chip, t);
        return (
          <RemoveChipLink
            key={chipKey(chip)}
            href={`${hrefFor(withoutChip(current, chip))}#filters`}
            label={label}
            removeLabel={t("remove", { chip: label })}
          />
        );
      })}
      <ButtonLink
        variant="link"
        render={<Link href={`${hrefFor(EMPTY_FILTERS)}#filters`} />}
        data-testid="applied-clear"
      >
        {t("clearAll")}
      </ButtonLink>
    </div>
  );
}
