// The order id cookies (`skf_placed`, spec 0004 AC-11; `skf_tracked`, spec 0015 AC-4): a JSON
// array of order uuids, newest first. Holding an id is the key to that order's pages, so a
// sequential order number alone opens nothing. Pure, shared by both cookies.
import { isUuid } from "@/lib/uuid";

function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Order ids from a cookie value: uuids only, lower case, no repeats, at most `max`. Anything malformed is dropped. */
export function parseOrderIds(raw: string | undefined, max: number): readonly string[] {
  const data = raw ? readJson(raw) : null;
  if (!Array.isArray(data)) return [];
  const ids = data.filter(isUuid).map((id) => id.toLowerCase());
  return [...new Set(ids)].slice(0, max);
}

/** Puts `id` first and keeps the newest `max`. */
export function addOrderId(ids: readonly string[], id: string, max: number): readonly string[] {
  const added = id.toLowerCase();
  return [added, ...ids.filter((kept) => kept !== added)].slice(0, max);
}

export function serializeOrderIds(ids: readonly string[]): string {
  return JSON.stringify(ids);
}
