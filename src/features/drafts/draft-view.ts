// What a draft line shows and how a draft adds up (spec 0020 AC-6, AC-11, AC-13, AC-14). Pure,
// so the page, its tests, and the send check agree on options, totals, and problems.
import { computeOrderTotals } from "@/features/orders/totals";

/** One option of a line's product, with its live price. `sellable` is the full rule (spec 0008). */
export type DraftOption = {
  readonly id: string;
  readonly code: string | null;
  readonly sizeLabel: string | null;
  readonly colourName: string | null;
  readonly price: number;
  readonly sellable: boolean;
  readonly archived: boolean;
};

export type DraftProduct = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly imageKey: string | null;
  /** The product can be sold at all: listed, available, and with a sellable option. */
  readonly sellable: boolean;
  /** Its options with `archived_at is null` in `sort` order, plus the line's own option if archived. */
  readonly options: readonly DraftOption[];
};

/** A line as the server returns it: empty, product only, or complete. */
export type DraftLineView = {
  readonly id: string;
  readonly sort: number;
  readonly quantity: number | null;
  readonly product: DraftProduct | null;
  readonly option: DraftOption | null;
};

/** A select's choice: a value, or null for the "without" choice (بدون حجم, بدون لون). */
export type OptionChoice = { readonly value: string | null; readonly available: boolean };

/** What is picked in a select: a value, null for "without", or undefined for nothing yet. */
export type Picked = string | null | undefined;

export type ResolvedOption = {
  readonly showSize: boolean;
  readonly showColour: boolean;
  readonly sizes: readonly OptionChoice[];
  readonly colours: readonly OptionChoice[];
  /** The product has sizes and none is chosen yet, so colour waits. */
  readonly colourDisabled: boolean;
  /** The one option that matches what is chosen, or null while two or more (or none) match. */
  readonly option: DraftOption | null;
};

function choices(
  options: readonly DraftOption[],
  valueOf: (option: DraftOption) => string | null,
): readonly OptionChoice[] {
  return options.reduce<OptionChoice[]>((list, option) => {
    const value = valueOf(option);
    const index = list.findIndex((choice) => choice.value === value);
    if (index === -1) return [...list, { value, available: option.sellable }];
    if (option.sellable && !list[index].available) {
      return list.map((choice, i) => (i === index ? { value, available: true } : choice));
    }
    return list;
  }, []);
}

/**
 * The selects of a line and the option they settle (AC-6). A select shows only when some option
 * carries that dimension; colours list only those that exist with the chosen size; exactly one
 * match becomes the line's option.
 */
export function resolveOption(
  options: readonly DraftOption[],
  size: Picked,
  colour: Picked,
): ResolvedOption {
  const showSize = options.some((option) => option.sizeLabel !== null);
  const showColour = options.some((option) => option.colourName !== null);
  const colourDisabled = showSize && size === undefined;
  const withSize =
    showSize && size !== undefined ? options.filter((o) => o.sizeLabel === size) : options;
  const matches =
    showColour && colour !== undefined ? withSize.filter((o) => o.colourName === colour) : withSize;
  return {
    showSize,
    showColour,
    sizes: showSize ? choices(options, (o) => o.sizeLabel) : [],
    colours: showColour && !colourDisabled ? choices(withSize, (o) => o.colourName) : [],
    colourDisabled,
    option: matches.length === 1 ? matches[0] : null,
  };
}

/** The colour to keep after the size changes: cleared when it does not exist with the new size. */
export function colourAfterSize(options: readonly DraftOption[], size: Picked, colour: Picked) {
  if (colour === undefined) return undefined;
  const exists = options.some((o) => o.sizeLabel === size && o.colourName === colour);
  return exists ? colour : undefined;
}

/** The lowest live price over the product's options, and whether the prices differ ("من"). */
export function productPrice(product: DraftProduct): {
  readonly price: number;
  readonly from: boolean;
} {
  const prices = product.options.filter((o) => !o.archived).map((o) => o.price);
  if (prices.length === 0) return { price: 0, from: false };
  const price = Math.min(...prices);
  return { price, from: prices.some((p) => p !== price) };
}

/** The line cannot be sold as it stands (AC-14): its product, or its chosen option, fails the rule. */
export function lineUnavailable(line: DraftLineView): boolean {
  if (!line.product) return false;
  return !line.product.sellable || (line.option !== null && !line.option.sellable);
}

export type CompleteLine = DraftLineView & {
  readonly product: DraftProduct;
  readonly option: DraftOption;
  readonly quantity: number;
};

/** Product, option, and quantity are all set (AC-8). */
export function isComplete(line: DraftLineView): line is CompleteLine {
  return line.product !== null && line.option !== null && line.quantity !== null;
}

/** Complete and sellable: the only lines that count in the totals and can be ordered. */
export function countsInTotal(line: DraftLineView): line is CompleteLine {
  return isComplete(line) && line.option.sellable && !lineUnavailable(line);
}

export type DraftTotals = {
  readonly subtotal: number;
  /** The zone fee, or null when not delivering to an active zone. */
  readonly deliveryFee: number | null;
  readonly total: number;
  /** Lines left out because they are incomplete or not sellable. */
  readonly excluded: number;
};

/** المجموع, التوصيل, الإجمالي (AC-11), with the same arithmetic as an order (spec 0004). */
export function draftTotals(
  lines: readonly DraftLineView[],
  deliveryFee: number | null,
): DraftTotals {
  const counted = lines.filter(countsInTotal);
  const { subtotal, total } = computeOrderTotals({
    lines: counted.map((line) => ({ unitPrice: line.option.price, quantity: line.quantity })),
    deliveryFee: deliveryFee ?? 0,
    discountTotal: 0,
  });
  return { subtotal, deliveryFee, total, excluded: lines.length - counted.length };
}

export type LineProblemReason = "no_product" | "no_option" | "no_quantity";

export type LineProblem = {
  readonly lineId: string;
  /** 1 based, by the lines' order. */
  readonly position: number;
  readonly reason: LineProblemReason;
};

/** Each line that is not complete, with the first thing it misses (AC-13), in order. */
export function lineProblems(
  lines: readonly Pick<DraftLineView, "id" | "product" | "option" | "quantity">[],
): readonly LineProblem[] {
  return lines.flatMap((line, index) => {
    const reason: LineProblemReason | null = !line.product
      ? "no_product"
      : !line.option
        ? "no_option"
        : line.quantity === null
          ? "no_quantity"
          : null;
    return reason ? [{ lineId: line.id, position: index + 1, reason }] : [];
  });
}

/** Where the electrician is sent: to the line's quantity or product field, by the problem. */
export const problemField = (reason: LineProblemReason) =>
  reason === "no_quantity" ? "quantity" : reason === "no_option" ? "option" : "product";
