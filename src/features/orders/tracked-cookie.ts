// The `skf_tracked` cookie (spec 0015 AC-4): ids of the orders this browser unlocked with a
// lookup (order number plus phone), newest first. With `skf_placed` it opens `/orders/<number>`.
import { addOrderId, parseOrderIds } from "./order-ids-cookie";

export const TRACKED_COOKIE = "skf_tracked";
export const MAX_TRACKED = 10;
export const TRACKED_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Order ids from the cookie: uuids only, no repeats, at most 10. Anything malformed is dropped. */
export function parseTracked(raw: string | undefined): readonly string[] {
  return parseOrderIds(raw, MAX_TRACKED);
}

/** Puts `id` first and keeps the newest 10. */
export function addTracked(ids: readonly string[], id: string): readonly string[] {
  return addOrderId(ids, id, MAX_TRACKED);
}
