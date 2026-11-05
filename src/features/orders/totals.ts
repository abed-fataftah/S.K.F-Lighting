// Order money math in integer agorot (1 ₪ = 100 agorot). Pure: no database, no rounding.

export type TotalsLine = {
  readonly unitPrice: number;
  readonly quantity: number;
  /** Units given back (feature 34). They stay in `line_total` but leave the subtotal. */
  readonly returnedQuantity?: number;
};

export type OrderTotals = { readonly subtotal: number; readonly total: number };

function assertAgorot(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non negative integer of agorot, got ${value}`);
  }
}

function assertCount(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non negative integer, got ${value}`);
  }
}

/** The ordered amount of one line: `unit_price * quantity`, as the database checks it. */
export function computeLineTotal(unitPrice: number, quantity: number): number {
  assertAgorot("unitPrice", unitPrice);
  assertCount("quantity", quantity);
  return unitPrice * quantity;
}

/** Subtotal over the kept units of every line, then `total = subtotal + deliveryFee - discountTotal`. */
export function computeOrderTotals(input: {
  readonly lines: readonly TotalsLine[];
  readonly deliveryFee: number;
  readonly discountTotal: number;
}): OrderTotals {
  assertAgorot("deliveryFee", input.deliveryFee);
  assertAgorot("discountTotal", input.discountTotal);

  const subtotal = input.lines.reduce((sum, line) => {
    const returned = line.returnedQuantity ?? 0;
    assertCount("returnedQuantity", returned);
    if (returned > line.quantity) {
      throw new RangeError(`returnedQuantity ${returned} is more than quantity ${line.quantity}`);
    }
    return sum + computeLineTotal(line.unitPrice, line.quantity - returned);
  }, 0);

  const total = subtotal + input.deliveryFee - input.discountTotal;
  if (total < 0) {
    throw new RangeError(`order total would be below 0 (${total})`);
  }
  return { subtotal, total };
}
