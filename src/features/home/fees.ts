// The delivery fees Home shows (spec 0011 AC-6), from the same `delivery_zones` rows checkout uses.
// Pure: the shop layout builds the strip, the delivery trust card builds its line.
import { formatPrice } from "@/lib/money";

export type ZoneFee = { readonly shortName: string; readonly fee: number };

/** `الضفة ₪20 · الداخل ₪70`, in the order given; null when there is no active zone (or no read). */
export function buildZoneLine(fees: readonly ZoneFee[] | null): string | null {
  if (!fees?.length) return null;
  return fees.map((zone) => `${zone.shortName} ${formatPrice(zone.fee)}`).join(" · ");
}

/**
 * The yellow strip: the zone line inside its words (`Home.strip`, "توصيل: {zones}"), or null to
 * hide the strip. `words` is the translator call, so the copy stays in ar.json.
 */
export function buildStripText(
  fees: readonly ZoneFee[] | null,
  words: (zones: string) => string,
): string | null {
  const zones = buildZoneLine(fees);
  return zones === null ? null : words(zones);
}
