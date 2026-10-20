// The one sellable rule (spec 0002): product `active` and available, variant available and not
// archived. Every read (home grid, product page, cart) and `placeOrder` use it.
export type SellableProduct = {
  readonly status: "active" | "hidden" | "archived";
  readonly isAvailable: boolean;
};

export type SellableVariant = {
  readonly isAvailable: boolean;
  readonly archivedAt: Date | null;
};

export function isSellable(product: SellableProduct, variant: SellableVariant): boolean {
  return (
    product.status === "active" &&
    product.isAvailable &&
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
