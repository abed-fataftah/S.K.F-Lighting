// What the cart shows (spec 0004 AC-4, AC-5): the cookie's lines joined to live catalog rows, in
// cart order. Pure, so the cart page, checkout, and `placeOrder` all agree on prices and on which
// lines can be sold.
import { isSellable, type SellableProduct } from "@/features/catalog/sellable";
import { computeLineTotal, computeOrderTotals } from "@/features/orders/totals";
import type { CartLine } from "./cart-cookie";

/** One variant as read from the catalog for a cart line. */
export type CartRow = {
  readonly variantId: string;
  readonly productId: string;
  readonly productName: string;
  readonly productCode: string;
  readonly slug: string;
  readonly productStatus: SellableProduct["status"];
  readonly productAvailable: boolean;
  /** The product's category is shown (spec 0008 AC-6); a hidden one makes the line not sellable. */
  readonly categoryShown: boolean;
  readonly variantCode: string | null;
  readonly sizeLabel: string | null;
  readonly colourName: string | null;
  readonly price: number;
  readonly variantAvailable: boolean;
  readonly archivedAt: Date | null;
};

export type CartViewLine = {
  readonly variantId: string;
  /** Null when the variant no longer exists; the page shows a generic name. */
  readonly productName: string | null;
  readonly productCode: string | null;
  /** Null when the product page is gone (missing, not active, or in a category not shown). */
  readonly slug: string | null;
  readonly sizeLabel: string | null;
  readonly colourName: string | null;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly lineTotal: number;
  readonly sellable: boolean;
};

export type CartView = {
  readonly lines: readonly CartViewLine[];
  /** Sellable lines only; an unsellable line blocks checkout instead. */
  readonly subtotal: number;
  readonly hasUnsellable: boolean;
};

export const emptyCartView: CartView = { lines: [], subtotal: 0, hasUnsellable: false };

export function buildCartView(cart: readonly CartLine[], rows: readonly CartRow[]): CartView {
  const byId = new Map(rows.map((row) => [row.variantId, row]));
  const lines = cart.map((line): CartViewLine => {
    const row = byId.get(line.variantId);
    if (!row) {
      return {
        variantId: line.variantId,
        productName: null,
        productCode: null,
        slug: null,
        sizeLabel: null,
        colourName: null,
        unitPrice: 0,
        quantity: line.quantity,
        lineTotal: 0,
        sellable: false,
      };
    }
    return {
      variantId: line.variantId,
      productName: row.productName,
      productCode: row.productCode,
      slug: row.productStatus === "active" && row.categoryShown ? row.slug : null,
      sizeLabel: row.sizeLabel,
      colourName: row.colourName,
      unitPrice: row.price,
      quantity: line.quantity,
      lineTotal: computeLineTotal(row.price, line.quantity),
      sellable: isSellable(
        {
          status: row.productStatus,
          isAvailable: row.productAvailable,
          categoryShown: row.categoryShown,
        },
        { isAvailable: row.variantAvailable, archivedAt: row.archivedAt },
      ),
    };
  });
  const sellable = lines.filter((line) => line.sellable);
  return {
    lines,
    subtotal: sellable.reduce((sum, line) => sum + line.lineTotal, 0),
    hasUnsellable: sellable.length < lines.length,
  };
}

/** The total the checkout summary shows and sends as `expectedTotal` (AC-8). */
export function checkoutTotal(cart: CartView, deliveryFee: number): number {
  return computeOrderTotals({
    lines: cart.lines
      .filter((line) => line.sellable)
      .map((line) => ({ unitPrice: line.unitPrice, quantity: line.quantity })),
    deliveryFee,
    discountTotal: 0,
  }).total;
}
