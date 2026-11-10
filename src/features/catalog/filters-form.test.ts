import { describe, expect, it } from "vitest";
import { routes } from "@/lib/routes";
import {
  filtersOf,
  formOf,
  instantFilters,
  listAction,
  listHref,
  type FiltersForm,
} from "./filters-form";
import { EMPTY_FILTERS, type ListFilters } from "./list-filters";

const applied: ListFilters = {
  sizes: ["60"],
  colours: ["ذهبي"],
  min: 100,
  max: 500,
  available: true,
};

// covers: AC-10 (spec 0010, spec 0029): one form state for the filters screen and the column.
describe("formOf and filtersOf", () => {
  it("round trips the applied filters", () => {
    expect(formOf(applied)).toEqual({
      sizes: ["60"],
      colours: ["ذهبي"],
      min: "100",
      max: "500",
      available: true,
    });
    expect(filtersOf(formOf(applied))).toEqual(applied);
    expect(filtersOf(formOf(EMPTY_FILTERS))).toEqual(EMPTY_FILTERS);
  });

  it("reads typed Arabic digits and swaps a reversed price, as the address does", () => {
    const form: FiltersForm = { ...formOf(EMPTY_FILTERS), min: "٥٠٠", max: "١٠٠" };
    expect(filtersOf(form)).toMatchObject({ min: 100, max: 500 });
  });
});

describe("listHref and listAction", () => {
  it("builds page 1 of the category or search list with the filters", () => {
    const category = { kind: "category", main: "lamps", sub: "wall" } as const;
    expect(listHref(category, applied)).toBe(routes.categoryPage("lamps", "wall", 1, applied));
    expect(listHref({ kind: "search", q: "ثريا" }, applied)).toBe(
      routes.searchPage("ثريا", applied),
    );
  });

  it("submits to the unfiltered list's own address", () => {
    expect(listAction({ kind: "category", main: "lamps", sub: null })).toBe("/c/lamps");
    expect(listAction({ kind: "search", q: "ثريا" })).toBe("/search");
  });
});

// covers: AC-10 (spec 0029): a chip applies at once; a typed price waits for its button.
describe("instantFilters", () => {
  it("applies the new chips and switch with the price as last applied", () => {
    const next: FiltersForm = {
      ...formOf(applied),
      sizes: ["60", "80"],
      available: false,
      min: "900",
      max: "",
    };
    expect(instantFilters(next, applied)).toEqual({
      sizes: ["60", "80"],
      colours: ["ذهبي"],
      min: 100,
      max: 500,
      available: false,
    });
  });
});
