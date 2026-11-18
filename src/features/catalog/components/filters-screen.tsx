"use client";

import { ListFilter, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { useCloseAtDesktop } from "@/lib/use-close-at-desktop";
import { filtersOf, formOf, listAction, listHref, type FiltersScope } from "../filters-form";
import { EMPTY_FILTERS, type FilterChoices, type ListFilters } from "../list-filters";
import { FilterFields, useFiltersForm } from "./filter-fields";

// The filter button and the filters screen (spec 0010 AC-10 to AC-12; pages/category.md, board
// "شاشة التصفية"), shared by category pages and search. The screen is a full screen dialog over a
// GET form to the list's own address: the submit handler builds the filters from the form state
// and pushes the address through `routes`, and the native submit still applies them before the
// page hydrates (the pressed chips and the switch are mirrored in hidden fields). While it is
// open, each change asks the count route for N, debounced and aborting the request before it.

const COUNT_DEBOUNCE_MS = 250;

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
  const [form, setForm] = useFiltersForm(applied);
  const filters = filtersOf(form);
  const [count, setCount] = useLiveCount(open, scope, filters, total);
  const trigger = useRef<HTMLButtonElement>(null);
  // Its button is hidden from lg, where the filter column stands in (spec 0029 AC-11).
  useCloseAtDesktop(open, setOpen);
  const statusId = useId();

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
  const action = listAction(scope);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        ref={trigger}
        id="filters"
        // From lg the filter column is always open beside the list (spec 0029 AC-10).
        render={<Button variant="outline" size="sm" className="lg:hidden" />}
        data-testid="filters-button"
      >
        <ListFilter aria-hidden />
        {t("button")}
        {badge > 0 ? (
          <span className="inline-flex size-5.5 items-center justify-center rounded-full bg-brand type-caption font-extrabold text-ink">
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

            <FilterFields choices={choices} form={form} onChange={(next) => setForm(next)} />
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
          <p id={statusId} aria-live="polite" className="sr-only">
            {count === null ? "" : applyLabel}
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
