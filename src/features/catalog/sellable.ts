// The one sellable rule (spec 0002, spec 0008 AC-7): product `active` and available, its category
// shown, variant available and not archived. Every storefront read (home grid, category pages,
// product page, cart) and `placeOrder` use it; `sellableVariant` in `server/storefront-sql.ts` is
// the same rule in SQL, and `sellable-parity.db.test.ts` keeps the two in step.
export type SellableProduct = {
  readonly status: "active" | "hidden" | "archived";
  readonly isAvailable: boolean;
  /** The product's category is shown: it and its main are visible (spec 0008 AC-6). */
  readonly categoryShown: boolean;
};

export type SellableVariant = {
  readonly isAvailable: boolean;
  readonly archivedAt: Date | null;
};

export function isSellable(product: SellableProduct, variant: SellableVariant): boolean {
  return (
    product.status === "active" &&
    product.isAvailable &&
    product.categoryShown &&
    variant.isAvailable &&
    variant.archivedAt === null
  );
}

/** The variant the product page adds: the default if sellable, else the first sellable by `sort`. */
export function pickVariantToAdd<V extends SellableVariant & { isDefault: boolean; sort: number }>(
  product: SellableProduct,
  variants: readonly V[],
): V | null {
  const sellable = variants.filter((variant) => isSellable(product, variant));
  return (
    sellable.find((variant) => variant.isDefault) ??
    [...sellable].sort((a, b) => a.sort - b.sort)[0] ??
    null
  );
}
