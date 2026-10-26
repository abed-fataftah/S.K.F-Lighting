// What a product card shows (spec 0008 AC-12, design.md section 7), the same card on the home grid
// and the category pages. Pure: the reads hand over rows, this decides chips, price, and stock.
import { tidyText } from "@/lib/arabic";
import { isSellable, type SellableProduct, type SellableVariant } from "./sellable";

type ProductSpec = { readonly label: string; readonly value: string };

export const MAX_CARD_CHIPS = 3;

export type CardProduct = {
  readonly slug: string;
  readonly name: string;
  readonly code: string;
  /** The first photo's object key, or null for the placeholder. */
  readonly imageKey: string | null;
  readonly chips: readonly string[];
  /** In stock: the lowest sellable price. Out of stock: the lowest live price. Null: no live variant. */
  readonly listPrice: number | null;
  /** Sellable prices differ, so the price reads `من ₪X`. Always false out of stock. */
  readonly pricesDiffer: boolean;
  readonly inStock: boolean;
  /** The variant "add to cart" puts in the cart; null when out of stock. */
  readonly addVariantId: string | null;
};

export type CardVariant = SellableVariant & {
  readonly id: string;
  readonly price: number;
  readonly isDefault: boolean;
  readonly sort: number;
};

export type CardSource = {
  readonly slug: string;
  readonly name: string;
  readonly code: string;
  readonly specs: readonly ProductSpec[];
  readonly product: SellableProduct;
  readonly variants: readonly CardVariant[];
  readonly imageKey: string | null;
};

/** The first three spec values that are not empty after tidying, in stored order. */
export function cardChips(specs: readonly ProductSpec[]): readonly string[] {
  return specs
    .map((spec) => tidyText(spec.value))
    .filter((value) => value !== "")
    .slice(0, MAX_CARD_CHIPS);
}

/**
 * The card variant: sellable, lowest price, then the default, then the lowest `sort`, so the cart
 * line costs what the card shows. The product page keeps `pickVariantToAdd`.
 */
export function pickCardVariant<V extends CardVariant>(
  product: SellableProduct,
  variants: readonly V[],
): V | null {
  const sellable = variants.filter((variant) => isSellable(product, variant));
  return (
    [...sellable].sort(
      (a, b) =>
        a.price - b.price ||
        Number(b.isDefault) - Number(a.isDefault) ||
        a.sort - b.sort ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )[0] ?? null
  );
}

const lowest = (prices: readonly number[]) => (prices.length ? Math.min(...prices) : null);

export function buildCardProduct(source: CardSource): CardProduct {
  const sellable = source.variants.filter((variant) => isSellable(source.product, variant));
  const inStock = sellable.length > 0;
  const prices = (inStock ? sellable : source.variants.filter((v) => v.archivedAt === null)).map(
    (variant) => variant.price,
  );
  const listPrice = lowest(prices);
  return {
    slug: source.slug,
    name: source.name,
    code: source.code,
    imageKey: source.imageKey,
    chips: cardChips(source.specs),
    listPrice,
    pricesDiffer: inStock && listPrice !== null && Math.max(...prices) !== listPrice,
    inStock,
    addVariantId: pickCardVariant(source.product, source.variants)?.id ?? null,
  };
}

/**
 * Category list order (AC-10): products with a sellable variant first, then the rest; newest first
 * inside each group (`created_at desc, id desc`). The list SQL orders the same way.
 */
export function compareListedProducts(
  a: { readonly inStock: boolean; readonly createdAt: Date; readonly id: string },
  b: { readonly inStock: boolean; readonly createdAt: Date; readonly id: string },
): number {
  if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
  const time = b.createdAt.getTime() - a.createdAt.getTime();
  if (time !== 0) return time;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}
