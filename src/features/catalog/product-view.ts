import { z } from "zod";
import { routes } from "@/lib/routes";
import { isSellable, pickVariantToAdd, type SellableProduct } from "./sellable";

// The product page's choosing rules (spec 0009 AC-1 to AC-10). The server builds the page data
// from its read with `buildProductPage`; the client then only moves between sellable variants with
// `chooseSize`, `chooseColour`, and `reconcileSelection`, never recomputing the first pick.

export type ProductSize = { readonly label: string };
export type ProductColour = {
  readonly id: string;
  readonly name: string;
  readonly hex: string | null;
};

export type OptionVariant = {
  readonly id: string;
  readonly sizeLabel: string | null;
  readonly colourId: string | null;
  readonly price: number;
  /** Sellable and on a chip in every group the product has (AC-2). */
  readonly sellable: boolean;
};

export type ProductOptions = {
  readonly sizes: readonly ProductSize[];
  readonly colours: readonly ProductColour[];
  /** Live variants in `sort` order. */
  readonly variants: readonly OptionVariant[];
};

export type ProductPhoto = {
  readonly key: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly alt: string | null;
};

export type ProductPageData = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly code: string;
  readonly description: string | null;
  readonly specs: readonly { readonly label: string; readonly value: string }[];
  readonly breadcrumb: {
    readonly main: { readonly name: string; readonly slug: string };
    readonly sub: { readonly name: string; readonly slug: string } | null;
  };
  readonly options: ProductOptions;
  /** A sellable live variant, or null when the product is out of stock (AC-3, AC-7). */
  readonly selectedId: string | null;
  /** Out of stock: the default live variant's price, else the first live one's (AC-7). */
  readonly mutedPrice: number | null;
  readonly inStock: boolean;
  readonly photos: readonly ProductPhoto[];
  readonly video: { readonly key: string } | null;
};

export type ReadVariant = {
  readonly id: string;
  readonly sizeLabel: string | null;
  readonly sizeSort: number;
  readonly colourId: string | null;
  readonly colourName: string | null;
  readonly colourHex: string | null;
  readonly price: number;
  readonly isAvailable: boolean;
  readonly archivedAt: Date | null;
  readonly isDefault: boolean;
  readonly sort: number;
};

export type ReadMedia = ProductPhoto & { readonly kind: "image" | "video" };

export type ProductPageInput = {
  readonly product: Pick<
    ProductPageData,
    "id" | "slug" | "name" | "code" | "description" | "specs"
  > &
    Pick<SellableProduct, "status" | "isAvailable">;
  readonly category: { readonly name: string; readonly slug: string };
  /** The category's main when the product sits in a sub. */
  readonly parent: { readonly name: string; readonly slug: string } | null;
  readonly variants: readonly ReadVariant[];
  /** In `sort, id` order. */
  readonly media: readonly ReadMedia[];
};

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The lowest `key` per group, so a chip sorts by its first variant. */
function lowest<T>(rows: readonly T[], group: (row: T) => string | null, key: (row: T) => number) {
  const found = new Map<string, { readonly row: T; readonly key: number }>();
  for (const row of rows) {
    const id = group(row);
    if (id === null) continue;
    const seen = found.get(id);
    if (!seen || key(row) < seen.key) found.set(id, { row, key: key(row) });
  }
  return [...found.entries()];
}

/** The size and colour groups and the live variants, archived rows left out (AC-1, AC-2). */
export function buildProductOptions(
  product: SellableProduct,
  rows: readonly ReadVariant[],
): ProductOptions {
  const live = rows
    .filter((row) => row.archivedAt === null)
    .sort((a, b) => a.sort - b.sort || a.sizeSort - b.sizeSort || byText(a.id, b.id));
  const sizes = lowest(
    live,
    (row) => row.sizeLabel,
    (row) => row.sizeSort,
  )
    .sort(([a, x], [b, y]) => x.key - y.key || byText(a, b))
    .map(([label]) => ({ label }));
  const colours = lowest(
    live,
    (row) => row.colourId,
    (row) => row.sort,
  )
    .map(([id, { row, key }]) => ({ id, name: row.colourName ?? "", hex: row.colourHex, key }))
    .sort((a, b) => a.key - b.key || byText(a.name, b.name))
    .map(({ id, name, hex }) => ({ id, name, hex }));
  // A variant missing a size (or colour) that the others have sits on no chip: never selectable.
  const fits = (row: ReadVariant) =>
    (sizes.length === 0 || row.sizeLabel !== null) &&
    (colours.length === 0 || row.colourId !== null);
  return {
    sizes,
    colours,
    variants: live.map((row) => ({
      id: row.id,
      sizeLabel: row.sizeLabel,
      colourId: row.colourId,
      price: row.price,
      sellable: fits(row) && isSellable(product, row),
    })),
  };
}

/** The page data with the server's first pick, before `?v` is applied (AC-1, AC-4, AC-7). */
export function buildProductPage(input: ProductPageInput): ProductPageData {
  const { product, category, parent } = input;
  const sellableProduct = {
    status: product.status,
    isAvailable: product.isAvailable,
    categoryShown: true,
  };
  const options = buildProductOptions(sellableProduct, input.variants);
  const selectable = new Set(options.variants.filter((v) => v.sellable).map((v) => v.id));
  const live = input.variants.filter((row) => row.archivedAt === null);
  const picked = pickVariantToAdd(
    sellableProduct,
    live.filter((row) => selectable.has(row.id)),
  );
  const muted =
    live.find((row) => row.isDefault) ?? [...live].sort((a, b) => a.sort - b.sort)[0] ?? null;
  const video = input.media.find((item) => item.kind === "video");
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    code: product.code,
    description: product.description,
    specs: product.specs,
    breadcrumb: parent ? { main: parent, sub: category } : { main: category, sub: null },
    options,
    selectedId: picked?.id ?? null,
    mutedPrice: muted?.price ?? null,
    inStock: selectable.size > 0,
    photos: input.media
      .filter((item) => item.kind === "image")
      .map(({ key, width, height, alt }) => ({ key, width, height, alt })),
    video: video ? { key: video.key } : null,
  };
}

const requestedVariant = z.uuid();

/** `searchParams.v`: its first value when repeated, a uuid or null (AC-4). */
export function parseRequestedVariant(raw: string | readonly string[] | undefined): string | null {
  const value = typeof raw === "string" ? raw : raw?.[0];
  const parsed = requestedVariant.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const variantOf = (options: ProductOptions, id: string | null) =>
  id === null ? null : (options.variants.find((variant) => variant.id === id) ?? null);

const pairOf = (options: ProductOptions, size: string | null, colourId: string | null) =>
  options.variants.find((v) => v.sizeLabel === size && v.colourId === colourId) ?? null;

const isPicked = (options: ProductOptions, id: string | null) =>
  variantOf(options, id)?.sellable === true;

/** `?v` wins when it names a sellable live variant of this product, else the server's pick (AC-4). */
export function applyRequestedVariant<D extends Pick<ProductPageData, "options" | "selectedId">>(
  data: D,
  requestedId: string | null,
): D {
  return isPicked(data.options, requestedId) ? { ...data, selectedId: requestedId } : data;
}

export const hasOptions = (options: ProductOptions) =>
  options.sizes.length > 0 || options.colours.length > 0;

export type SizeChip = { readonly label: string; readonly enabled: boolean };
export type ColourChip = ProductColour & { readonly enabled: boolean };

/** A size is enabled when any sellable variant has it (AC-3). */
export function sizeChips(options: ProductOptions): readonly SizeChip[] {
  return options.sizes.map(({ label }) => ({
    label,
    enabled: options.variants.some((v) => v.sellable && v.sizeLabel === label),
  }));
}

/** Follow the size: with sizes, a colour is enabled only when its pair with `size` sells (AC-3). */
export function colourChips(options: ProductOptions, size: string | null): readonly ColourChip[] {
  const hasSizes = options.sizes.length > 0;
  return options.colours.map((colour) => ({
    ...colour,
    enabled:
      (!hasSizes || size !== null) &&
      pairOf(options, hasSizes ? size : null, colour.id)?.sellable === true,
  }));
}

/** The chips pressed for a selection. */
export function selectedValues(options: ProductOptions, id: string | null) {
  const variant = variantOf(options, id);
  return { size: variant?.sizeLabel ?? null, colourId: variant?.colourId ?? null };
}

/** Keeps the colour when that pair sells, else the first enabled colour for `size` (AC-3). */
export function chooseSize(
  options: ProductOptions,
  currentId: string | null,
  size: string,
): string | null {
  const keep = pairOf(options, size, variantOf(options, currentId)?.colourId ?? null);
  if (keep?.sellable) return keep.id;
  if (!options.colours.length) return currentId;
  const first = colourChips(options, size).find((chip) => chip.enabled);
  return first ? (pairOf(options, size, first.id)?.id ?? currentId) : currentId;
}

/** The pair of the current size and `colourId` when it sells, else no move (AC-3). */
export function chooseColour(
  options: ProductOptions,
  currentId: string | null,
  colourId: string,
): string | null {
  const size = variantOf(options, currentId)?.sizeLabel ?? null;
  if (options.sizes.length > 0 && size === null) return currentId;
  const pair = pairOf(options, size, colourId);
  return pair?.sellable ? pair.id : currentId;
}

/** After a refresh: keep the visitor's choice while it still sells, else the server's pick (AC-8). */
export function reconcileSelection(
  options: ProductOptions,
  currentId: string | null,
  selectedId: string | null,
): string | null {
  return isPicked(options, currentId) ? currentId : selectedId;
}

/** The shown price and its size note; muted with no note when nothing is selected (AC-5, AC-7). */
export function priceLine(
  options: ProductOptions,
  selectedId: string | null,
  mutedPrice: number | null,
): { readonly price: number | null; readonly size: string | null; readonly muted: boolean } {
  const variant = variantOf(options, selectedId);
  return variant
    ? { price: variant.price, size: variant.sizeLabel, muted: false }
    : { price: mutedPrice, size: null, muted: true };
}

/** W3's size and colour part: whichever exist, space separated (AC-9). */
export function selectionText(options: ProductOptions, selectedId: string | null): string {
  const variant = variantOf(options, selectedId);
  if (!variant) return "";
  const colour = options.colours.find((c) => c.id === variant.colourId)?.name ?? null;
  return [variant.sizeLabel, colour].filter(Boolean).join(" ");
}

/** The absolute link for W3 and share: with `?v` for a product with options, else bare (AC-9). */
export function productLink(
  siteUrl: string,
  data: Pick<ProductPageData, "slug" | "options">,
  selectedId: string | null,
): string {
  const variant = hasOptions(data.options) ? selectedId : null;
  return `${siteUrl}${routes.product(data.slug, { variant })}`;
}

export type GalleryItem =
  | {
      readonly kind: "photo";
      readonly key: string;
      readonly alt: string;
      /** 1 based, for "صورة N". */
      readonly n: number;
    }
  | { readonly kind: "video"; readonly key: string };

/** The photos in order, then the video; a photo with no alt gets "<name>، صورة N" (AC-10). */
export function galleryItems(
  photos: readonly ProductPhoto[],
  video: { readonly key: string } | null,
  fallbackAlt: (n: number) => string,
): readonly GalleryItem[] {
  return [
    ...photos.map((photo, index) => ({
      kind: "photo" as const,
      key: photo.key,
      alt: photo.alt?.trim() || fallbackAlt(index + 1),
      n: index + 1,
    })),
    ...(video ? [{ kind: "video" as const, key: video.key }] : []),
  ];
}

/** One step through `count` items, looping at both ends (AC-10, AC-12). */
export const stepIndex = (index: number, step: 1 | -1, count: number) =>
  count > 0 ? (index + step + count) % count : 0;
