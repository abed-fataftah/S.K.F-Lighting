import { routes } from "@/lib/routes";
import { parseListFilters, type ListFilters } from "./list-filters";

// The filters form's state and its address (spec 0010 AC-10 to AC-12, spec 0029 AC-10), shared by
// the filters screen and the desktop filter column. Pure: the components hold the state.

export type FiltersScope =
  | { readonly kind: "category"; readonly main: string; readonly sub: string | null }
  | { readonly kind: "search"; readonly q: string };

/** What the fields show: the price as typed, so Arabic digits survive until they parse. */
export type FiltersForm = {
  readonly sizes: readonly string[];
  readonly colours: readonly string[];
  readonly min: string;
  readonly max: string;
  readonly available: boolean;
};

export const formOf = (filters: ListFilters): FiltersForm => ({
  sizes: filters.sizes,
  colours: filters.colours,
  min: filters.min === null ? "" : String(filters.min),
  max: filters.max === null ? "" : String(filters.max),
  available: filters.available,
});

/** The form read by the same parser as the address, so typed Arabic digits and swaps match. */
export function filtersOf(form: FiltersForm): ListFilters {
  const params = new URLSearchParams();
  for (const size of form.sizes) params.append("size", size);
  for (const colour of form.colours) params.append("colour", colour);
  params.append("min", form.min);
  params.append("max", form.max);
  if (form.available) params.append("available", "1");
  return parseListFilters(params);
}

/** Page 1 of the list with `filters` applied. */
export const listHref = (scope: FiltersScope, filters: ListFilters): string =>
  scope.kind === "category"
    ? routes.categoryPage(scope.main, scope.sub, 1, filters)
    : routes.searchPage(scope.q, filters);

/** Where the form submits without JavaScript: the list's own address, which reads the fields. */
export const listAction = (scope: FiltersScope): string =>
  scope.kind === "category" ? routes.categoryPage(scope.main, scope.sub) : routes.search();

/**
 * The filter column applies a chip or the switch at once, with the price as last applied: a
 * typed but not applied price waits for its button (spec 0029 AC-10).
 */
export const instantFilters = (next: FiltersForm, applied: ListFilters): ListFilters => ({
  ...filtersOf(next),
  min: applied.min,
  max: applied.max,
});
