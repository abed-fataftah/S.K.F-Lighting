// The `skf_placed` cookie (spec 0004 AC-11): ids of the last orders this browser placed, newest
// first. It is the only key to a confirmation page, so a sequential order number alone opens nothing.
import { isUuid } from "@/lib/uuid";

export const PLACED_COOKIE = "skf_placed";
export const MAX_PLACED = 5;
export const PLACED_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Order ids from the cookie: uuids only, no repeats, at most 5. Anything malformed is dropped. */
export function parsePlaced(raw: string | undefined): readonly string[] {
  const data = raw ? readJson(raw) : null;
  if (!Array.isArray(data)) return [];
  const ids = data.filter(isUuid).map((id) => id.toLowerCase());
  return [...new Set(ids)].slice(0, MAX_PLACED);
}

/** Puts `id` first and keeps the newest 5. */
export function addPlaced(ids: readonly string[], id: string): readonly string[] {
  const added = id.toLowerCase();
  return [added, ...ids.filter((kept) => kept !== added)].slice(0, MAX_PLACED);
}

export function serializePlaced(ids: readonly string[]): string {
  return JSON.stringify(ids);
}
