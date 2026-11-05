// The `skf_placed` cookie (spec 0004 AC-11): ids of the last orders this browser placed, newest
// first. It is the only key to a confirmation page, so a sequential order number alone opens nothing.
import { addOrderId, parseOrderIds, serializeOrderIds } from "@/features/orders/order-ids-cookie";

export const PLACED_COOKIE = "skf_placed";
export const MAX_PLACED = 5;
export const PLACED_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** Order ids from the cookie: uuids only, no repeats, at most 5. Anything malformed is dropped. */
export function parsePlaced(raw: string | undefined): readonly string[] {
  return parseOrderIds(raw, MAX_PLACED);
}

/** Puts `id` first and keeps the newest 5. */
export function addPlaced(ids: readonly string[], id: string): readonly string[] {
  return addOrderId(ids, id, MAX_PLACED);
}

export const serializePlaced = serializeOrderIds;
