// Quantity rules for the stepper (design.md section 6): whole numbers from 1 to 99.
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;

/**
 * Turns what the shopper typed into a quantity when they leave the field or press Enter.
 * Empty or not a number keeps the last good value; anything else is clamped to the range.
 */
export function commitQuantity(
  typed: string,
  last: number,
  min: number = MIN_QUANTITY,
  max: number = MAX_QUANTITY,
): number {
  const trimmed = typed.trim();
  if (!/^\d+$/.test(trimmed)) return last;
  return Math.min(max, Math.max(min, Number(trimmed)));
}

/** One step down or up, never leaving the range. */
export function stepQuantity(
  value: number,
  step: 1 | -1,
  min: number = MIN_QUANTITY,
  max: number = MAX_QUANTITY,
): number {
  return Math.min(max, Math.max(min, value + step));
}
