// The colour search of the product editor (spec 0006 AC-5). Pure.
import { tidyText } from "@/lib/arabic";
import type { ColourRow } from "./editor-state";
import { optionKey } from "./schemas";

export type ColourChoice = { readonly id: string; readonly name: string };

/** What a typed query offers: matching listed colours, and whether "add «name»" applies (AC-5). */
export function colourMatches(
  query: string,
  listed: readonly ColourChoice[],
  onProduct: readonly Pick<ColourRow, "colourId" | "name">[],
) {
  const key = optionKey(query);
  const takenIds = new Set(onProduct.flatMap((row) => (row.colourId ? [row.colourId] : [])));
  const takenNames = new Set(onProduct.map((row) => optionKey(row.name)));
  const free = listed.filter((colour) => !takenIds.has(colour.id));
  const exact = listed.find((colour) => optionKey(colour.name) === key);
  return {
    choices: key ? free.filter((colour) => optionKey(colour.name).includes(key)) : free,
    /** The typed name is a colour already on the product. */
    already: !!key && (takenNames.has(key) || (!!exact && takenIds.has(exact.id))),
    exact: exact && !takenIds.has(exact.id) ? exact : null,
    canAdd: !!key && !exact && !takenNames.has(key),
    name: tidyText(query),
  };
}
