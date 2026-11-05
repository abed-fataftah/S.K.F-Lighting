import { normalizeForSearch, tidyText } from "@/lib/arabic";

// Storefront search rules (spec 0010 AC-2 to AC-4, AC-7). Pure: the stored keys a product save
// writes, the query a shopper typed, the `like` patterns, and the relevance tier in code (the SQL
// in `server/list-query.ts` computes the same tier; the database tests hold them together).

export const SEARCH_QUERY_MAX = 100;
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_WORDS = 8;

const codePoints = (text: string) => Array.from(text);

/**
 * `products.search_text` (AC-7): the folded name, product code, and live option codes (already in
 * `sort` order), joined by single spaces with empty parts left out. The name comes first, so a
 * query the text starts with is tier 2.
 */
export function buildSearchText(
  name: string,
  code: string,
  optionCodes: readonly (string | null)[],
): string {
  return [name, code, ...optionCodes]
    .flatMap((part) => (part ? [normalizeForSearch(part)] : []))
    .filter((part) => part !== "")
    .join(" ");
}

/** `product_variants.size_key` (AC-7): the folded label with no spaces, or null when empty. */
export function sizeKey(sizeLabel: string | null): string | null {
  if (sizeLabel === null) return null;
  const key = normalizeForSearch(sizeLabel).replace(/\s/g, "");
  return key === "" ? null : key;
}

/** The text the page shows and links carry: the first `q`, cut to 100 code points, tidied. */
export function shownQuery(raw: string | readonly string[] | undefined): string {
  const first = typeof raw === "string" ? raw : (raw?.[0] ?? "");
  return tidyText(codePoints(first).slice(0, SEARCH_QUERY_MAX).join(""));
}

export const foldedQuery = (shown: string): string => normalizeForSearch(shown);

/** The folded query split on spaces, duplicates removed, the first 8 kept. */
export function queryWords(folded: string): readonly string[] {
  const words = folded.split(" ").filter((word) => word !== "");
  return [...new Set(words)].slice(0, SEARCH_MAX_WORDS);
}

/** Compared with the stored codes, which are `upper(btrim)` by their checks (AC-4). */
export const codeQuery = (folded: string): string => folded.toUpperCase();

export type SearchTerms = {
  /** What the page shows and links carry. */
  readonly text: string;
  readonly folded: string;
  readonly words: readonly string[];
  readonly code: string;
};

/**
 * The search a `q` asks for (AC-1, AC-2): none (no `q`), too short (under 2 folded characters,
 * the prompt with its note), or the terms the read runs with.
 */
export type SearchRequest =
  | { readonly kind: "none" }
  | { readonly kind: "short"; readonly text: string }
  | ({ readonly kind: "search" } & SearchTerms);

export function readSearchRequest(raw: string | readonly string[] | undefined): SearchRequest {
  const text = shownQuery(raw);
  if (text === "") return { kind: "none" };
  const folded = foldedQuery(text);
  if (codePoints(folded).length < SEARCH_MIN_CHARS) return { kind: "short", text };
  return { kind: "search", text, folded, words: queryWords(folded), code: codeQuery(folded) };
}

/** A word as a `like ... escape '\'` substring pattern, its `%`, `_`, and `\` taken literally. */
export function likePattern(word: string): string {
  return `%${word.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export type SearchTier = 0 | 1 | 2 | 3;

/**
 * The relevance tier (AC-4): 0 when the product code or a live option code equals the code query,
 * 1 when one starts with it, 2 when `search_text` starts with the folded query, else 3.
 */
export function searchTier(
  product: {
    readonly code: string;
    readonly optionCodes: readonly (string | null)[];
    readonly searchText: string;
  },
  query: Pick<SearchTerms, "folded" | "code">,
): SearchTier {
  const codes = [product.code, ...product.optionCodes].filter((code): code is string => !!code);
  if (codes.some((code) => code === query.code)) return 0;
  if (codes.some((code) => code.startsWith(query.code))) return 1;
  if (product.searchText.startsWith(query.folded)) return 2;
  return 3;
}
