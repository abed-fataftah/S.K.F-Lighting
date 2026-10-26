import { tidyText } from "@/lib/arabic";
import { parseListFilters, type ListFilters } from "./list-filters";
import { readSearchRequest, type SearchTerms } from "./search-text";

// The count route's params (spec 0010 AC-12): one scope, a category (`main`, optional `sub`) or a
// search (`q`), never both and never neither, plus the same filter params the pages read. Pure.

export type CountRequest =
  | { readonly kind: "bad_request" }
  | {
      readonly kind: "category";
      readonly main: string;
      readonly sub: string | null;
      readonly filters: ListFilters;
    }
  | ({ readonly kind: "search"; readonly filters: ListFilters } & SearchTerms)
  /** A `q` under 2 folded characters: no read, the count is 0. */
  | { readonly kind: "too_short" };

const first = (params: URLSearchParams, name: string) => {
  const value = params.get(name);
  return value === null ? null : tidyText(value);
};

export function readCountRequest(params: URLSearchParams): CountRequest {
  const main = first(params, "main");
  const sub = first(params, "sub");
  const hasQuery = params.has("q");
  const hasCategory = main !== null || sub !== null;
  if (hasQuery === hasCategory) return { kind: "bad_request" };

  const filters = parseListFilters(params);
  if (hasCategory) {
    if (!main) return { kind: "bad_request" };
    return { kind: "category", main, sub: sub || null, filters };
  }
  const request = readSearchRequest(params.getAll("q"));
  if (request.kind !== "search") return { kind: "too_short" };
  const { text, folded, words, code } = request;
  return { kind: "search", text, folded, words, code, filters };
}
