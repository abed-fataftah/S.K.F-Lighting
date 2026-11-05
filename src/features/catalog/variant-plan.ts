// The variant reconcile (spec 0006 AC-3 to AC-7). Pure: given what the editor wants and the rows
// that exist, it says which rows to update, restore, insert, archive, relabel, or delete, and which
// one is the default. `saveProduct` runs the plan in one transaction; feature 8's import reuses it.

/** One size row of the editor, in order. `originalLabel` is the label when the editor loaded it. */
export type WantedSize = {
  readonly originalLabel: string | null;
  readonly label: string;
  readonly price: number;
};

/** One pair of the editor: indexes into the sizes and colours (null on the side that has none). */
export type WantedPair = {
  readonly size: number | null;
  readonly colour: number | null;
  readonly available: boolean;
};

export type WantedVariants = {
  readonly sizes: readonly WantedSize[];
  /** Colour ids in their order (new colours already created). */
  readonly colours: readonly string[];
  readonly pairs: readonly WantedPair[];
  /** The single price, used when there are no sizes. */
  readonly price: number | null;
};

export type ExistingVariant = {
  readonly id: string;
  readonly sizeLabel: string | null;
  readonly sizeSort: number;
  readonly colourId: string | null;
  readonly sort: number;
  readonly archivedAt: Date | null;
};

/** The columns a live row ends with. */
export type PlannedRow = {
  /** `size:colour` indexes, `-` for a side the product has none of. */
  readonly key: string;
  readonly sizeLabel: string | null;
  readonly sizeSort: number;
  readonly colourId: string | null;
  readonly sort: number;
  readonly price: number;
  readonly isAvailable: boolean;
};

export type VariantPlan = {
  /** Live rows kept; `moved` when their (label, colour) changes, so the save renames them in two passes. */
  readonly updates: readonly (PlannedRow & { readonly id: string; readonly moved: boolean })[];
  /** Archived rows brought back for a pair added again. */
  readonly restores: readonly (PlannedRow & { readonly id: string })[];
  readonly inserts: readonly PlannedRow[];
  /** Live rows no longer wanted that an order or draft points at. */
  readonly archives: readonly string[];
  /** Live rows no longer wanted that nothing points at. */
  readonly deletes: readonly string[];
  /** Archived rows (old or archived now) holding a (label, colour) a live row needs. */
  readonly relabels: readonly { readonly id: string; readonly sizeLabel: string }[];
  /** The `key` of the row that becomes `is_default`. */
  readonly defaultKey: string;
};

export const archivedLabel = (variantId: string) => `__archived_${variantId}`;
export const tempLabel = (variantId: string) => `__tmp_${variantId}`;

const pairKey = (size: number | null, colour: number | null) => `${size ?? "-"}:${colour ?? "-"}`;
const identity = (sizeLabel: string | null, colourId: string | null) =>
  JSON.stringify([sizeLabel, colourId]);

type Target = PlannedRow & { readonly originalLabel: string | null; readonly hasSize: boolean };

/** Every wanted pair as the row it should be, by size order then colour order. */
function targetsOf(wanted: WantedVariants): readonly Target[] {
  const simple = wanted.sizes.length === 0 && wanted.colours.length === 0;
  const pairs: readonly WantedPair[] = simple
    ? [{ size: null, colour: null, available: true }]
    : wanted.pairs;

  return pairs
    .map((pair): Target => {
      const size = pair.size === null ? null : wanted.sizes[pair.size];
      const price = size ? size.price : wanted.price;
      if (price === null) throw new Error("planVariants: a pair has no price");
      return {
        key: pairKey(pair.size, pair.colour),
        sizeLabel: size ? size.label : null,
        sizeSort: pair.size ?? 0,
        colourId: pair.colour === null ? null : wanted.colours[pair.colour],
        sort: pair.colour ?? 0,
        price,
        // A simple product has no tick of its own: the product switch is its only control (AC-3).
        isAvailable: simple ? true : pair.available,
        originalLabel: size ? size.originalLabel : null,
        hasSize: size !== null,
      };
    })
    .sort((a, b) => a.sizeSort - b.sizeSort || a.sort - b.sort);
}

/** A live row is the same pair when its size is the size row as loaded and its colour is the same. */
function matches(row: ExistingVariant, target: Target): boolean {
  if (row.colourId !== target.colourId) return false;
  if (!target.hasSize) return row.sizeLabel === null;
  // A size row added in this edit has no original label and never matches a live row.
  return target.originalLabel !== null && row.sizeLabel === target.originalLabel;
}

const strip = (target: Target): PlannedRow => ({
  key: target.key,
  sizeLabel: target.sizeLabel,
  sizeSort: target.sizeSort,
  colourId: target.colourId,
  sort: target.sort,
  price: target.price,
  isAvailable: target.isAvailable,
});

export function planVariants(
  wanted: WantedVariants,
  existing: readonly ExistingVariant[],
  orderedVariantIds: ReadonlySet<string>,
): VariantPlan {
  const targets = targetsOf(wanted);
  const live = [...existing]
    .filter((row) => row.archivedAt === null)
    .sort((a, b) => a.sizeSort - b.sizeSort || a.sort - b.sort);
  const archived = existing.filter((row) => row.archivedAt !== null);

  // Pair each target with its live row.
  const matched = new Map<string, ExistingVariant>();
  const used = new Set<string>();
  for (const target of targets) {
    const row = live.find((candidate) => !used.has(candidate.id) && matches(candidate, target));
    if (row) {
      matched.set(target.key, row);
      used.add(row.id);
    }
  }

  // Simple ⇄ options keeps the plain row's id, so carts survive (AC-7, Matching).
  const simple = targets.length === 1 && targets[0].sizeLabel === null && !targets[0].colourId;
  const first = targets[0];
  if (simple && !matched.has(first.key)) {
    const firstLive = live.find((row) => !used.has(row.id));
    if (firstLive) {
      matched.set(first.key, firstLive);
      used.add(firstLive.id);
    }
  } else if (!simple && first && !matched.has(first.key)) {
    const plain = live.find(
      (row) => !used.has(row.id) && row.sizeLabel === null && row.colourId === null,
    );
    if (plain) {
      matched.set(first.key, plain);
      used.add(plain.id);
    }
  }

  const updates: VariantPlan["updates"][number][] = [];
  const restores: VariantPlan["restores"][number][] = [];
  const inserts: PlannedRow[] = [];
  const restoredIds = new Set<string>();

  for (const target of targets) {
    const row = matched.get(target.key);
    if (row) {
      updates.push({
        ...strip(target),
        id: row.id,
        moved:
          identity(row.sizeLabel, row.colourId) !== identity(target.sizeLabel, target.colourId),
      });
      continue;
    }
    const old = archived.find(
      (candidate) =>
        !restoredIds.has(candidate.id) &&
        identity(candidate.sizeLabel, candidate.colourId) ===
          identity(target.sizeLabel, target.colourId),
    );
    if (old) {
      restoredIds.add(old.id);
      restores.push({ ...strip(target), id: old.id });
    } else {
      inserts.push(strip(target));
    }
  }

  const removed = live.filter((row) => !used.has(row.id));
  const archives = removed.filter((row) => orderedVariantIds.has(row.id)).map((row) => row.id);
  const deletes = removed.filter((row) => !orderedVariantIds.has(row.id)).map((row) => row.id);

  // Archived rows (old ones not restored, and the ones archived now) give up a (label, colour)
  // that a renamed or inserted live row needs.
  const needed = new Set(
    [...updates, ...inserts].map((row) => identity(row.sizeLabel, row.colourId)),
  );
  const staysArchived = [
    ...archived.filter((row) => !restoredIds.has(row.id)),
    ...removed.filter((row) => orderedVariantIds.has(row.id)),
  ];
  const relabels = staysArchived
    .filter((row) => needed.has(identity(row.sizeLabel, row.colourId)))
    .map((row) => ({ id: row.id, sizeLabel: archivedLabel(row.id) }));

  // Exactly one default: the first available pair by size then colour order, else the first pair.
  const defaultTarget = targets.find((target) => target.isAvailable) ?? targets[0];

  return {
    updates,
    restores,
    inserts,
    archives,
    deletes,
    relabels,
    defaultKey: defaultTarget.key,
  };
}
