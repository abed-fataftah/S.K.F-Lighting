// Adding a catalog product to a draft (spec 0021): what the add does to the draft, the sheet's
// quantity rule, and where the sheet starts. Pure, so the action, the sheet, and the tests agree.
import { tidyText, toWesternDigits } from "@/lib/arabic";
import { resolveOption, type DraftOption, type Picked } from "./draft-view";
import { DRAFT_MAX_QUANTITY } from "./quantity";
import { MAX_DRAFT_LINES } from "./schemas";

export type CatalogAddPlan =
  | { readonly kind: "merge"; readonly quantity: number; readonly position: number }
  | { readonly kind: "append"; readonly position: number }
  | { readonly kind: "quantity_over"; readonly position: number; readonly current: number }
  | { readonly kind: "too_many_lines" };

/**
 * AC-8: the option already on the draft grows by `quantity` (a line with no quantity counts as 0)
 * unless that passes 999; otherwise a new line goes last, unless the draft holds 30 lines.
 */
export function planCatalogAdd({
  existing,
  lineCount,
  quantity,
}: {
  readonly existing: { readonly position: number; readonly quantity: number | null } | null;
  readonly lineCount: number;
  readonly quantity: number;
}): CatalogAddPlan {
  if (existing) {
    const current = existing.quantity ?? 0;
    if (current + quantity > DRAFT_MAX_QUANTITY) {
      return { kind: "quantity_over", position: existing.position, current };
    }
    return { kind: "merge", quantity: current + quantity, position: existing.position };
  }
  if (lineCount >= MAX_DRAFT_LINES) return { kind: "too_many_lines" };
  return { kind: "append", position: lineCount + 1 };
}

/** AC-6: a whole number from 1 to 999, Arabic or Latin digits; null for anything else. */
export function commitPickerQuantity(typed: string): number | null {
  const clean = toWesternDigits(tidyText(typed));
  if (!/^\d+$/.test(clean)) return null;
  const value = Number(clean);
  return value >= 1 && value <= DRAFT_MAX_QUANTITY ? value : null;
}

export type PickerOption = { readonly size: Picked; readonly colour: Picked };

const NOTHING: PickerOption = { size: undefined, colour: undefined };

/** The selects' values for an option, when it is among `options` and sellable; else nothing. */
export function keepOption(
  options: readonly DraftOption[],
  variantId: string | null,
): PickerOption {
  const option = options.find((o) => o.id === variantId);
  return option?.sellable ? { size: option.sizeLabel, colour: option.colourName } : NOTHING;
}

/**
 * Where the sheet starts (AC-5, AC-6, AC-10): the page's option only when it is among the
 * options and sellable, else nothing chosen (`resolveOption` still settles a single option), and
 * the page's quantity (1 from a card).
 */
export function pickerStart(
  options: readonly DraftOption[],
  pageVariantId: string | null,
  pageQuantity: number,
): PickerOption & { readonly quantity: string } {
  return { ...keepOption(options, pageVariantId), quantity: String(pageQuantity) };
}

/** The option the selects settle on, or null while none or several match. */
export const pickedOption = (options: readonly DraftOption[], picked: PickerOption) =>
  resolveOption(options, picked.size, picked.colour).option;

/** The radio value of the "+ مسودة جديدة" row. */
export const NEW_DRAFT = "new";

/**
 * The chosen draft row (AC-7, AC-11): `current` while it is still listed (the new draft row while
 * under 30 drafts), else the newest draft, or the new draft row when there are none.
 */
export function chooseDraft(
  drafts: readonly { readonly id: string }[],
  current: string | null,
  draftLimitReached: boolean,
): string {
  if (current === NEW_DRAFT && !draftLimitReached) return NEW_DRAFT;
  if (current !== null && drafts.some((draft) => draft.id === current)) return current;
  return drafts[0]?.id ?? NEW_DRAFT;
}
