"use client";

import { ListFilter, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Chip } from "@/components/chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import {
  EMPTY_FILTERS,
  parseListFilters,
  type FilterChoices,
  type ListFilters,
} from "../list-filters";

// The filter button and the filters screen (spec 0010 AC-10 to AC-12; pages/category.md, board
// "شاشة التصفية"), shared by category pages and search. The screen is a full screen dialog over a
// GET form to the list's own address: the submit handler builds the filters from the form state
// and pushes the address through `routes`, and the native submit still applies them before the
// page hydrates (the pressed chips and the switch are mirrored in hidden fields). While it is
// open, each change asks the count route for N, debounced and aborting the request before it.

export type FiltersScope =
  | { readonly kind: "category"; readonly main: string; readonly sub: string | null }
  | { readonly kind: "search"; readonly q: string };

const COUNT_DEBOUNCE_MS = 250;

type FormState = {
  readonly sizes: readonly string[];
  readonly colours: readonly string[];
  readonly min: string;
  readonly max: string;
  readonly available: boolean;
};

const formOf = (filters: ListFilters): FormState => ({
  sizes: filters.sizes,
  colours: filters.colours,
  min: filters.min === null ? "" : String(filters.min),
  max: filters.max === null ? "" : String(filters.max),
  available: filters.available,
});

/** The form state read by the same parser as the address, so typed Arabic digits and swaps match. */
function filtersOf(form: FormState): ListFilters {
  const params = new URLSearchParams();
  for (const size of form.sizes) params.append("size", size);
  for (const colour of form.colours) params.append("colour", colour);
  params.append("min", form.min);
  params.append("max", form.max);
  if (form.available) params.append("available", "1");
  return parseListFilters(params);
}

const listHref = (scope: FiltersScope, filters: ListFilters) =>
  scope.kind === "category"
    ? routes.categoryPage(scope.main, scope.sub, 1, filters)
    : routes.searchPage(scope.q, filters);

/** N for the current choices from the count route; null while unknown or on any failure. */
function useLiveCount(open: boolean, scope: FiltersScope, filters: ListFilters, initial: number) {
  const [count, setCount] = useState<number | null>(initial);
  const href = routes.catalogCount(scope, filters);
  const first = useRef(true);

  useEffect(() => {
    if (!open) {
      first.current = true;
      return;
    }
    // On open the form holds the applied filters, whose count the page already shows.
    if (first.current) {
      first.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(href, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const body: unknown = await response.json();
        const next = (body as { count?: unknown }).count;
        setCount(typeof next === "number" ? next : null);
      } catch {
        if (!controller.signal.aborted) setCount(null);
      }
    }, COUNT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, href]);

  return [count, setCount] as const;
}

export function FiltersScreen({
  scope,
  choices,
  applied,
  badge,
  total,
}: {
  readonly scope: FiltersScope;
  readonly choices: FilterChoices;
  /** The resolved filters, in address form: the screen opens on them. */
  readonly applied: ListFilters;
  /** How many applied chips the list shows. */
  readonly badge: number;
  /** M for the applied filters. */
  readonly total: number;
}) {
  const t = useTranslations("Filters");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => formOf(applied));
  const filters = filtersOf(form);
  const [count, setCount] = useLiveCount(open, scope, filters, total);
  const trigger = useRef<HTMLButtonElement>(null);
  const ids = { size: useId(), colour: useId(), price: useId(), status: useId() };

  // A chip × or "clear all" link lands on `#filters`: focus the button again (AC-11).
  useEffect(() => {
    if (window.location.hash === "#filters") trigger.current?.focus();
  }, [applied]);

  const onOpenChange = (next: boolean) => {
    if (next) {
      setForm(formOf(applied));
      setCount(total);
    }
    setOpen(next);
  };

  const apply = (next: ListFilters) => {
    setOpen(false);
    router.push(listHref(scope, next), { scroll: false });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    apply(filters);
  };

  const applyLabel =
    count === null
      ? t("applyFallback")
      : scope.kind === "search"
        ? t("applySearch", { count: formatNumber(count) })
        : t("apply", { count: formatNumber(count) });
  const action =
    scope.kind === "category" ? routes.categoryPage(scope.main, scope.sub) : routes.search();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        ref={trigger}
        id="filters"
        render={<Button variant="outline" size="sm" />}
        data-testid="filters-button"
      >
        <ListFilter aria-hidden />
        {t("button")}
        {badge > 0 ? (
          <span className="inline-flex size-5.5 items-center justify-center rounded-full bg-yellow type-caption font-extrabold text-ink">
            <span aria-hidden>{formatNumber(badge)}</span>
            <span className="sr-only">{t("badge", { count: formatNumber(badge) })}</span>
          </span>
        ) : null}
      </DialogTrigger>

      <DialogContent
        className="start-0 end-0 top-0 h-dvh max-h-dvh translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-page p-0"
        data-testid="filters-screen"
      >
        <form
          action={action}
          method="get"
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="on-dark flex items-center gap-2 bg-ink px-2 py-2 text-white">
            <DialogClose render={<Button variant="ghost" size="icon" aria-label={t("close")} />}>
              <X aria-hidden />
            </DialogClose>
            <DialogTitle render={<h1 />} className="type-title-s text-white">
              {t("title")}
            </DialogTitle>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-(--page-pad)">
            {scope.kind === "search" ? <input type="hidden" name="q" value={scope.q} /> : null}

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
                      onChange={(event) => setForm({ ...form, min: event.target.value })}
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
                      onChange={(event) => setForm({ ...form, max: event.target.value })}
                    />
                  </div>
                </div>
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
                  onValueChange={(value) => setForm({ ...form, sizes: value as string[] })}
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
                  onValueChange={(value) => setForm({ ...form, colours: value as string[] })}
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
              <Label htmlFor={`${ids.status}-available`} className="type-lead text-ink">
                {t("available")}
              </Label>
              <Switch
                id={`${ids.status}-available`}
                checked={form.available}
                onCheckedChange={(checked) => setForm({ ...form, available: checked })}
              />
              {form.available ? <input type="hidden" name="available" value="1" /> : null}
            </Card>
          </div>

          <div className="grid grid-cols-5 gap-2.5 border-t border-border bg-white px-(--page-pad) py-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="col-span-2"
              onClick={() => apply(EMPTY_FILTERS)}
            >
              {t("clearAll")}
            </Button>
            <Button type="submit" size="lg" className="col-span-3" data-testid="filters-apply">
              {applyLabel}
            </Button>
          </div>
          <p id={ids.status} aria-live="polite" className="sr-only">
            {count === null ? "" : applyLabel}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
