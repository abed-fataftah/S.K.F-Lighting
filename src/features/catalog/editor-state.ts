// The product editor's state in the browser (spec 0006 AC-2 to AC-9, AC-14). Pure: building it from
// the server's product, the payload `saveProduct` gets, row moves, and the pair ticks. Rows carry
// their own ids, so a tick, a focus, or a tile follows its row when rows move.
import { tidyText } from "@/lib/arabic";
import type { MediaKind } from "./media-rules";
import { SUGGESTED_SPEC_LABELS, type ProductEditorInput } from "./schemas";
import type { ProductEditorState } from "./server/admin-queries";

export type SizeRow = {
  readonly rowId: string;
  readonly originalLabel: string | null;
  readonly label: string;
  readonly price: string;
};

/** A listed colour (`colourId`) or a new name, created on save. */
export type ColourRow = {
  readonly rowId: string;
  readonly colourId: string | null;
  readonly name: string;
};

export type SpecRow = { readonly rowId: string; readonly label: string; readonly value: string };

export type MediaTile = {
  readonly tileId: string;
  readonly kind: MediaKind;
  /** `unusable`: the browser could not read or shrink it; `failed`: the upload broke (retry). */
  readonly status: "uploading" | "ready" | "failed" | "unusable";
  /** 0 to 100 while uploading. */
  readonly progress: number;
  readonly storageKey: string | null;
  readonly width: number | null;
  readonly height: number | null;
  /** A local preview (`blob:`) for a file picked in this visit. */
  readonly previewUrl: string | null;
};

export type EditorState = {
  readonly name: string;
  readonly code: string;
  readonly mainCategoryId: string;
  readonly subCategoryId: string;
  readonly description: string;
  readonly visible: boolean;
  readonly available: boolean;
  /** Kept while sizes exist, so removing the last size brings it back (AC-3). */
  readonly price: string;
  readonly sizes: readonly SizeRow[];
  readonly colours: readonly ColourRow[];
  /** Ticks by `pairId`; a pair with no entry is ticked (a new pair starts ticked, AC-6). */
  readonly ticks: Readonly<Record<string, boolean>>;
  readonly specs: readonly SpecRow[];
  readonly media: readonly MediaTile[];
};

/** Rows made in the browser need ids; any unique string will do. */
export type IdMaker = () => string;

/** The tick key of a size row and a colour row; `-` for the side the product has none of. */
export const pairId = (sizeRowId: string | null, colourRowId: string | null) =>
  `${sizeRowId ?? "-"}|${colourRowId ?? "-"}`;

export function emptyEditor(newId: IdMaker): EditorState {
  return {
    name: "",
    code: "",
    mainCategoryId: "",
    subCategoryId: "",
    description: "",
    visible: true,
    available: true,
    price: "",
    sizes: [],
    colours: [],
    ticks: {},
    // Only a new product opens with the suggested rows (AC-9).
    specs: SUGGESTED_SPEC_LABELS.map((label) => ({ rowId: newId(), label, value: "" })),
    media: [],
  };
}

export function editorFromProduct(product: ProductEditorState, newId: IdMaker): EditorState {
  const sizes = product.sizes.map((size) => ({ rowId: newId(), ...size }));
  const colours = product.colours.map((colour) => ({
    rowId: newId(),
    colourId: colour.colourId,
    name: colour.name,
  }));
  const ticks = Object.fromEntries(
    product.pairs.map((pair) => [
      pairId(
        pair.size === null ? null : sizes[pair.size].rowId,
        pair.colour === null ? null : colours[pair.colour].rowId,
      ),
      pair.available,
    ]),
  );
  return {
    name: product.name,
    code: product.code,
    mainCategoryId: product.mainCategoryId,
    subCategoryId: product.subCategoryId ?? "",
    description: product.description,
    visible: product.visible,
    available: product.available,
    price: product.price,
    sizes,
    colours,
    ticks,
    specs: product.specs.map((spec) => ({ rowId: newId(), ...spec })),
    media: product.media.map((item) => ({
      tileId: newId(),
      kind: item.kind,
      status: "ready",
      progress: 100,
      storageKey: item.storageKey,
      width: item.width,
      height: item.height,
      previewUrl: null,
    })),
  };
}

/** Every pair in grid order: sizes as rows, colours as columns; none for a simple product. */
export function pairsOf(state: Pick<EditorState, "sizes" | "colours" | "ticks">) {
  const sizes = state.sizes.length ? state.sizes.map((row, index) => ({ row, index })) : [null];
  const colours = state.colours.length
    ? state.colours.map((row, index) => ({ row, index }))
    : [null];
  if (!state.sizes.length && !state.colours.length) return [];
  return sizes.flatMap((size) =>
    colours.map((colour) => {
      const id = pairId(size?.row.rowId ?? null, colour?.row.rowId ?? null);
      return {
        id,
        size: size?.index ?? null,
        colour: colour?.index ?? null,
        sizeLabel: size?.row.label ?? null,
        colourName: colour?.row.name ?? null,
        available: state.ticks[id] ?? true,
      };
    }),
  );
}

/** The object `saveProduct` gets; `version` null creates the product. */
export function toPayload(
  state: EditorState,
  id: string,
  version: number | null,
): ProductEditorInput {
  return {
    id,
    version,
    name: state.name,
    code: state.code,
    categoryId: state.mainCategoryId,
    subCategoryId: state.subCategoryId,
    description: state.description,
    specs: state.specs.map(({ label, value }) => ({ label, value })),
    visible: state.visible,
    available: state.available,
    price: state.sizes.length ? undefined : state.price,
    sizes: state.sizes.map(({ originalLabel, label, price }) => ({ originalLabel, label, price })),
    colours: state.colours.map((row) =>
      row.colourId ? { colourId: row.colourId } : { newName: row.name },
    ),
    pairs: pairsOf(state).map(({ size, colour, available }) => ({ size, colour, available })),
    media: state.media
      .filter((tile) => tile.status === "ready" && tile.storageKey)
      .map((tile) => ({
        storageKey: tile.storageKey!,
        kind: tile.kind,
        width: tile.width,
        height: tile.height,
      })),
  };
}

/** What counts as a change for the leave warning (AC-14): the payload, plus any unsaved upload. */
export function changeKey(state: EditorState): string {
  const pending = state.media.filter((tile) => tile.status !== "ready").map((tile) => tile.tileId);
  return JSON.stringify([toPayload(state, "", null), pending]);
}

/**
 * After a save the stored labels are the tidied ones, so the next save matches the same rows, and
 * the selects show the stored category.
 */
export function afterSave(
  state: EditorState,
  category: { readonly mainCategoryId: string; readonly subCategoryId: string | null },
): EditorState {
  return {
    ...state,
    sizes: state.sizes.map((row) => ({ ...row, originalLabel: tidyText(row.label) })),
    mainCategoryId: category.mainCategoryId,
    subCategoryId: category.subCategoryId ?? "",
  };
}

/** Moves the item at `from` by `by` places (−1 earlier, +1 later); out of range changes nothing. */
export function move<T>(items: readonly T[], from: number, by: number): readonly T[] {
  const to = from + by;
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Photos first, in order, then the video (AC-8): how the tiles show and how `sort` is saved. */
export function photosThenVideo(media: readonly MediaTile[]) {
  return {
    photos: media.filter((tile) => tile.kind === "image"),
    video: media.find((tile) => tile.kind === "video") ?? null,
  };
}

/** Moves a photo among the photos only; the video keeps its place after them. */
export function movePhoto(media: readonly MediaTile[], tileId: string, by: number) {
  const { photos, video } = photosThenVideo(media);
  const moved = move(
    photos,
    photos.findIndex((tile) => tile.tileId === tileId),
    by,
  );
  return video ? [...moved, video] : moved;
}

/** "Make main": the photo moves first. */
export function makeMain(media: readonly MediaTile[], tileId: string) {
  const index = photosThenVideo(media).photos.findIndex((tile) => tile.tileId === tileId);
  return index < 0 ? media : movePhoto(media, tileId, -index);
}
