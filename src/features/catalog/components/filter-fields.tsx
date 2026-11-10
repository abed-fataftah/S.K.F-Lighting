"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { Chip } from "@/components/chip";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { formatNumber } from "@/lib/format";
import { formOf, type FiltersForm } from "../filters-form";
import { serializeListFilters, type FilterChoices, type ListFilters } from "../list-filters";

/**
 * The form state, starting from the applied filters and following them when the address changes
 * (a chip ×, "clear all", back), so the filter column shows what the list applies.
 */
export function useFiltersForm(applied: ListFilters) {
  const [form, setForm] = useState<FiltersForm>(() => formOf(applied));
  const appliedKey = serializeListFilters(applied);
  const [seen, setSeen] = useState(appliedKey);
  if (seen !== appliedKey) {
    setSeen(appliedKey);
    setForm(formOf(applied));
  }
  return [form, setForm] as const;
}

// The filter controls (spec 0010 AC-10; spec 0029 AC-10), shared by the filters screen and the
// desktop filter column: price, size chips, colour chips, and the "available only" switch, each
// in its card and only when the list offers it. The pressed chips and the switch are mirrored in
// hidden fields, so the surrounding GET form applies them before the page hydrates. `onChange`
// says whether the change is a chip or the switch (`instant`) or a typed price.
export function FilterFields({
  choices,
  form,
  onChange,
  priceAction,
}: {
  readonly choices: FilterChoices;
  readonly form: FiltersForm;
  readonly onChange: (next: FiltersForm, instant: boolean) => void;
  /** Under the price fields: the filter column's "apply price" button. */
  readonly priceAction?: ReactNode;
}) {
  const t = useTranslations("Filters");
  const ids = { size: useId(), colour: useId(), price: useId(), available: useId() };

  return (
    <>
      {choices.price ? (
        <Card className="gap-3">
          <h2 id={ids.price} className="type-lead">
            {t("price")}
          </h2>
          <div role="group" aria-labelledby={ids.price} className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${ids.price}-min`}>{t("priceFrom")}</Label>
              <Input
                id={`${ids.price}-min`}
                name="min"
                inputMode="numeric"
                autoComplete="off"
                placeholder={formatNumber(choices.price.min)}
                value={form.min}
                onChange={(event) => onChange({ ...form, min: event.target.value }, false)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${ids.price}-max`}>{t("priceTo")}</Label>
              <Input
                id={`${ids.price}-max`}
                name="max"
                inputMode="numeric"
                autoComplete="off"
                placeholder={formatNumber(choices.price.max)}
                value={form.max}
                onChange={(event) => onChange({ ...form, max: event.target.value }, false)}
              />
            </div>
          </div>
          {priceAction}
        </Card>
      ) : null}

      {choices.sizes.length ? (
        <Card className="gap-3">
          <h2 id={ids.size} className="type-lead">
            {t("size")}
          </h2>
          <ToggleGroup
            multiple
            aria-labelledby={ids.size}
            value={[...form.sizes]}
            onValueChange={(value) => onChange({ ...form, sizes: value as string[] }, true)}
          >
            {choices.sizes.map((size) => (
              <Chip key={size.key} value={size.key}>
                {size.label}
              </Chip>
            ))}
          </ToggleGroup>
          {form.sizes.map((key) => (
            <input key={key} type="hidden" name="size" value={key} />
          ))}
        </Card>
      ) : null}

      {choices.colours.length ? (
        <Card className="gap-3">
          <h2 id={ids.colour} className="type-lead">
            {t("colour")}
          </h2>
          <ToggleGroup
            multiple
            aria-labelledby={ids.colour}
            value={[...form.colours]}
            onValueChange={(value) => onChange({ ...form, colours: value as string[] }, true)}
          >
            {choices.colours.map((colour) => (
              <Chip key={colour.id} value={colour.name}>
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-4.5 shrink-0 rounded-full border border-control-border"
                    // The swatch is catalog data (colours.hex), not a style token.
                    style={colour.hex ? { backgroundColor: colour.hex } : undefined}
                  />
                  {colour.name}
                </span>
              </Chip>
            ))}
          </ToggleGroup>
          {form.colours.map((name) => (
            <input key={name} type="hidden" name="colour" value={name} />
          ))}
        </Card>
      ) : null}

      <Card className="flex-row items-center justify-between gap-3">
        <Label id={`${ids.available}-label`} htmlFor={ids.available} className="type-lead text-ink">
          {t("available")}
        </Label>
        {/* Named by its label id: on the server Base UI gives `id` to the hidden input, so the
            label's `for` reaches the switch only after hydration. */}
        <Switch
          id={ids.available}
          aria-labelledby={`${ids.available}-label`}
          checked={form.available}
          onCheckedChange={(checked) => onChange({ ...form, available: checked }, true)}
        />
        {form.available ? <input type="hidden" name="available" value="1" /> : null}
      </Card>
    </>
  );
}
