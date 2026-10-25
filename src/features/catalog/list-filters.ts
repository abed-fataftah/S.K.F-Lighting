import { tidyText, toWesternDigits } from "@/lib/arabic";

// List filters in the address (spec 0010 AC-8 to AC-10, AC-13). Pure: reading the params of a
// category page, a search, or the count route (never throws, drops what it cannot read), keeping
// only the choices the list offers, writing them back in one fixed order, the applied chips, and
// the size choice rules. `server/list-query.ts` turns the resolved filters into SQL.

export const MAX_SIZE_PARAMS = 20;
export const MAX_COLOUR_PARAMS = 20;
export const MAX_PRICE_SHEKELS = 999_999;

/** What the address asks for, after the pure parse: size keys, colour names, whole shekels. */
export type ListFilters = {
  readonly sizes: readonly string[];
  readonly colours: readonly string[];
  readonly min: number | null;
  readonly max: number | null;
  readonly available: boolean;
};

export const EMPTY_FILTERS: ListFilters = {
  sizes: [],
  colours: [],
  min: null,
  max: null,
  available: false,
};

export type SizeChoice = { readonly key: string; readonly label: string };
export type ColourChoice = {
  readonly id: string;
  readonly name: string;
  readonly hex: string | null;
};

/** What the unfiltered list offers (AC-10); `price` is null for a list with no live option. */
export type FilterChoices = {
  readonly sizes: readonly SizeChoice[];
  readonly colours: readonly ColourChoice[];
  readonly price: { readonly min: number; readonly max: number } | null;
};

/** The filters the SQL sees: only sizes and colours among the choices, colour ids attached. */
export type ResolvedFilters = {
  readonly sizes: readonly SizeChoice[];
  readonly colours: readonly ColourChoice[];
  readonly min: number | null;
  readonly max: number | null;
  readonly available: boolean;
};

export const NO_FILTERS: ResolvedFilters = {
  sizes: [],
  colours: [],
  min: null,
  max: null,
  available: false,
};

type ParamSource =
  URLSearchParams | Readonly<Record<string, string | readonly string[] | undefined>>;

function values(source: ParamSource, name: string): readonly string[] {
  if (source instanceof URLSearchParams) return source.getAll(name);
  const value = source[name];
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : value;
}

const clean = (value: string) => tidyText(toWesternDigits(value));

function cleanList(raw: readonly string[], cap: number): readonly string[] {
  const kept = raw.map(clean).filter((value) => value !== "");
  return [...new Set(kept)].slice(0, cap);
}

function wholeShekels(raw: readonly string[]): number | null {
  const first = raw.length ? clean(raw[0]) : "";
  if (!/^\d{1,6}$/.test(first)) return null;
  const shekels = Number(first);
  return shekels >= 1 && shekels <= MAX_PRICE_SHEKELS ? shekels : null;
}

/** The filter params (AC-8): never throws; bad, empty, and repeated values are dropped. */
export function parseListFilters(source: ParamSource): ListFilters {
  const min = wholeShekels(values(source, "min"));
  const max = wholeShekels(values(source, "max"));
  const swap = min !== null && max !== null && min > max;
  const available = values(source, "available");
  return {
    sizes: cleanList(values(source, "size"), MAX_SIZE_PARAMS),
    colours: cleanList(values(source, "colour"), MAX_COLOUR_PARAMS),
    min: swap ? max : min,
    max: swap ? min : max,
    available: available.length > 0 && clean(available[0]) === "1",
  };
}

/** Keeps only the sizes and colours the list offers, in the address order, colour ids attached. */
export function resolveFilters(parsed: ListFilters, choices: FilterChoices): ResolvedFilters {
  const sizeOf = new Map(choices.sizes.map((size) => [size.key, size]));
  const colourOf = new Map(choices.colours.map((colour) => [colour.name, colour]));
  return {
    sizes: parsed.sizes.flatMap((key) => sizeOf.get(key) ?? []),
    colours: parsed.colours.flatMap((name) => colourOf.get(name) ?? []),
    min: parsed.min,
    max: parsed.max,
    available: parsed.available,
  };
}

/** The address form of resolved filters, for links. */
export const toListFilters = (filters: ResolvedFilters): ListFilters => ({
  sizes: filters.sizes.map((size) => size.key),
  colours: filters.colours.map((colour) => colour.name),
  min: filters.min,
  max: filters.max,
  available: filters.available,
});

/** "A filter is active" (AC-8): at least one size, colour, price bound, or `available`. */
export const isFiltered = (filters: ListFilters | ResolvedFilters): boolean =>
  filters.sizes.length > 0 ||
  filters.colours.length > 0 ||
  filters.min !== null ||
  filters.max !== null ||
  filters.available;

/**
 * The query string in its fixed order (`q`, `size`, `colour`, `min`, `max`, `available`, `page`),
 * empty values and page 1 left out; "" when nothing is left. Parsing it again gives the same.
 */
export function serializeListFilters(
  filters: ListFilters,
  opts: { readonly q?: string | null; readonly page?: number } = {},
): string {
  const params = new URLSearchParams();
  if (opts.q) params.append("q", opts.q);
  for (const size of filters.sizes) params.append("size", size);
  for (const colour of filters.colours) params.append("colour", colour);
  if (filters.min !== null) params.append("min", String(filters.min));
  if (filters.max !== null) params.append("max", String(filters.max));
  if (filters.available) params.append("available", "1");
  if (opts.page && opts.page > 1) params.append("page", String(opts.page));
  return params.toString();
}

export type AppliedChip =
  | { readonly kind: "size"; readonly key: string; readonly label: string }
  | { readonly kind: "colour"; readonly name: string }
  | { readonly kind: "price"; readonly min: number | null; readonly max: number | null }
  | { readonly kind: "available" };

/** One removable chip per size, per colour, one for the price, one for "available" (AC-13). */
export function appliedChips(filters: ResolvedFilters): readonly AppliedChip[] {
  return [
    ...filters.sizes.map((size) => ({ kind: "size" as const, key: size.key, label: size.label })),
    ...filters.colours.map((colour) => ({ kind: "colour" as const, name: colour.name })),
    ...(filters.min !== null || filters.max !== null
      ? [{ kind: "price" as const, min: filters.min, max: filters.max }]
      : []),
    ...(filters.available ? [{ kind: "available" as const }] : []),
  ];
}

/** The filters without one chip: what that chip's × links to. */
export function withoutChip(filters: ListFilters, chip: AppliedChip): ListFilters {
  switch (chip.kind) {
    case "size":
      return { ...filters, sizes: filters.sizes.filter((key) => key !== chip.key) };
    case "colour":
      return { ...filters, colours: filters.colours.filter((name) => name !== chip.name) };
    case "price":
      return { ...filters, min: null, max: null };
    case "available":
      return { ...filters, available: false };
  }
}

const LEADING_NUMBER = /^\d+(\.\d+)?/;

// Ties between keys with the same leading number read as text with Arabic before Latin, as the
// shop's labels are Arabic (`60سم` before `60x40`, spec 0010 AC-10): digits and ASCII marks first,
// then Arabic letters, then Latin letters, then anything else, each by code point.
function textWeight(codePoint: number): number {
  if (codePoint >= 0x0600 && codePoint <= 0x06ff) return 0x1_0000 + codePoint;
  if ((codePoint >= 0x41 && codePoint <= 0x5a) || (codePoint >= 0x61 && codePoint <= 0x7a)) {
    return 0x2_0000 + codePoint;
  }
  return codePoint < 0x80 ? codePoint : 0x3_0000 + codePoint;
}

function compareText(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    const diff = textWeight(left[i].codePointAt(0)!) - textWeight(right[i].codePointAt(0)!);
    if (diff !== 0) return diff;
  }
  return left.length - right.length;
}

/** By the key's leading number as a decimal, keys with none after, then by key as text (AC-10). */
export function compareSizeKeys(a: string, b: string): number {
  const left = LEADING_NUMBER.exec(a);
  const right = LEADING_NUMBER.exec(b);
  if (left && !right) return -1;
  if (!left && right) return 1;
  if (left && right && Number(left[0]) !== Number(right[0])) {
    return Number(left[0]) - Number(right[0]);
  }
  return compareText(a, b);
}

/**
 * One chip per distinct size key over the list's live options, labelled with its most common
 * label (a tie goes to the label that sorts first), in size order (AC-10).
 */
export function sizeChoices(
  options: readonly { readonly sizeKey: string | null; readonly sizeLabel: string | null }[],
): readonly SizeChoice[] {
  const labels = new Map<string, Map<string, number>>();
  for (const option of options) {
    if (option.sizeKey === null || option.sizeLabel === null) continue;
    const counts = labels.get(option.sizeKey) ?? new Map<string, number>();
    counts.set(option.sizeLabel, (counts.get(option.sizeLabel) ?? 0) + 1);
    labels.set(option.sizeKey, counts);
  }
  return [...labels.entries()]
    .map(([key, counts]) => {
      const [label] = [...counts.entries()].sort(
        ([a, countA], [b, countB]) => countB - countA || compareText(a, b),
      )[0];
      return { key, label };
    })
    .sort((a, b) => compareSizeKeys(a.key, b.key));
}

/** The price placeholders: the lowest live price rounded down, the highest up, in shekels. */
export function priceBounds(
  prices: { readonly min: number | null; readonly max: number | null } | null,
): FilterChoices["price"] {
  if (!prices || prices.min === null || prices.max === null) return null;
  return { min: Math.floor(prices.min / 100), max: Math.ceil(prices.max / 100) };
}
