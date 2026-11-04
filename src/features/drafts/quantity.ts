// The quantity of a draft line (spec 0020 AC-8): whole numbers from 1 to 999, or none yet.
import { tidyText, toWesternDigits } from "@/lib/arabic";

export const DRAFT_MAX_QUANTITY = 999;

/**
 * What the electrician typed, when they leave the field or press Enter. Arabic digits count;
 * empty means no quantity (null); digits are clamped to 1 to 999; anything else keeps `last`.
 */
export function commitDraftQuantity(typed: string, last: number | null): number | null {
  const clean = toWesternDigits(tidyText(typed));
  if (clean === "") return null;
  if (!/^\d+$/.test(clean)) return last;
  return Math.min(DRAFT_MAX_QUANTITY, Math.max(1, Number(clean)));
}
