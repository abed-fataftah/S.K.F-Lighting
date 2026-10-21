import { describe, expect, it } from "vitest";
import {
  afterSave,
  changeKey,
  editorFromProduct,
  emptyEditor,
  makeMain,
  move,
  movePhoto,
  pairId,
  pairsOf,
  toPayload,
  type EditorState,
  type MediaTile,
} from "./editor-state";
import { productEditorSchema } from "./schemas";
import type { ProductEditorState } from "./server/admin-queries";

// covers: AC-3, AC-4, AC-5, AC-6, AC-8, AC-9, AC-14 (spec 0006)

const ID = "1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b";
const CATEGORY = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const RED = "c0000000-0000-4000-8000-000000000001";

const ids = () => {
  let n = 0;
  return () => `r${(n += 1)}`;
};

const product: ProductEditorState = {
  id: ID,
  version: 3,
  name: "ثريا",
  code: "CH-1",
  slug: "ثريا-CH-1",
  mainCategoryId: CATEGORY,
  subCategoryId: null,
  description: "",
  specs: [{ label: "القدرة", value: "60W" }],
  visible: true,
  available: true,
  isArchived: false,
  hasOrders: false,
  price: "",
  sizes: [
    { originalLabel: "صغير", label: "صغير", price: "100" },
    { originalLabel: "كبير", label: "كبير", price: "200" },
  ],
  colours: [{ colourId: RED, name: "ذهبي" }],
  pairs: [
    { size: 0, colour: 0, available: true },
    { size: 1, colour: 0, available: false },
  ],
  media: [
    { storageKey: `products/${ID}/a.webp`, kind: "image", width: 10, height: 10 },
    { storageKey: `products/${ID}/v.mp4`, kind: "video", width: null, height: null },
  ],
};

const tile = (tileId: string, kind: MediaTile["kind"] = "image"): MediaTile => ({
  tileId,
  kind,
  status: "ready",
  progress: 100,
  storageKey: tileId,
  width: 1,
  height: 1,
  previewUrl: null,
});

describe("emptyEditor", () => {
  it("opens a new product visible and available, with the suggested spec rows", () => {
    const state = emptyEditor(ids());
    expect(state).toMatchObject({ visible: true, available: true, sizes: [], colours: [] });
    expect(state.specs.map((row) => [row.label, row.value])).toEqual([
      ["القطر (سم)", ""],
      ["الارتفاع (سم)", ""],
      ["نوع القاعدة", ""],
      ["القدرة", ""],
      ["لون الإضاءة", ""],
    ]);
  });
});

describe("editorFromProduct and toPayload", () => {
  it("round trips a stored product into a payload the schema accepts", () => {
    const state = editorFromProduct(product, ids());
    const payload = toPayload(state, ID, 3);
    expect(payload.pairs).toEqual(product.pairs);
    expect(payload.sizes).toEqual(
      product.sizes.map(({ originalLabel, label, price }) => ({ originalLabel, label, price })),
    );
    expect(payload.colours).toEqual([{ colourId: RED }]);
    expect(payload.price).toBeUndefined();
    expect(payload.media).toEqual(product.media);

    const parsed = productEditorSchema.parse({ ...payload, media: [] });
    expect(parsed.version).toBe(3);
  });

  it("keeps the existing specs and adds no suggested rows to a stored product", () => {
    expect(editorFromProduct(product, ids()).specs.map((row) => row.label)).toEqual(["القدرة"]);
  });

  it("sends a typed new colour by name, and the single price when there are no sizes", () => {
    const state: EditorState = {
      ...emptyEditor(ids()),
      price: "40",
      colours: [{ rowId: "c1", colourId: null, name: "ذهبي" }],
    };
    const payload = toPayload(state, ID, null);
    expect(payload.colours).toEqual([{ newName: "ذهبي" }]);
    expect(payload.price).toBe("40");
    expect(payload.pairs).toEqual([{ size: null, colour: 0, available: true }]);
  });

  it("leaves out tiles that are not uploaded", () => {
    const state: EditorState = {
      ...emptyEditor(ids()),
      media: [tile("a"), { ...tile("b"), status: "uploading" }, { ...tile("c"), status: "failed" }],
    };
    expect(toPayload(state, ID, null).media.map((m) => m.storageKey)).toEqual(["a"]);
  });
});

describe("pairsOf", () => {
  it("starts a new pair ticked and keeps ticks with their rows when rows move", () => {
    const base: EditorState = {
      ...emptyEditor(ids()),
      sizes: [
        { rowId: "s1", originalLabel: null, label: "S", price: "1" },
        { rowId: "s2", originalLabel: null, label: "L", price: "2" },
      ],
      colours: [{ rowId: "c1", colourId: RED, name: "ذهبي" }],
      ticks: { [pairId("s2", "c1")]: false },
    };
    expect(pairsOf(base).map((p) => [p.sizeLabel, p.available])).toEqual([
      ["S", true],
      ["L", false],
    ]);
    const swapped = { ...base, sizes: move(base.sizes, 1, -1) };
    expect(pairsOf(swapped).map((p) => [p.size, p.sizeLabel, p.available])).toEqual([
      [0, "L", false],
      [1, "S", true],
    ]);
  });

  it("has no pairs for a simple product", () => {
    expect(pairsOf(emptyEditor(ids()))).toEqual([]);
  });
});

describe("changeKey", () => {
  it("changes with an edit or an upload that is not saved, and not otherwise", () => {
    const state = editorFromProduct(product, ids());
    const base = changeKey(state);
    expect(changeKey({ ...state })).toBe(base);
    expect(changeKey({ ...state, name: "ثريا ٢" })).not.toBe(base);
    expect(
      changeKey({ ...state, media: [...state.media, { ...tile("n"), status: "uploading" }] }),
    ).not.toBe(base);
  });
});

describe("afterSave", () => {
  it("makes each size's stored label its tidied label, and selects the stored category", () => {
    const state: EditorState = {
      ...emptyEditor(ids()),
      sizes: [{ rowId: "s1", originalLabel: null, label: "  كبير   جدًا ", price: "1" }],
      newCategoryName: "إنارة",
    };
    const saved = afterSave(state, { mainCategoryId: CATEGORY, subCategoryId: null });
    expect(saved.sizes[0].originalLabel).toBe("كبير جدًا");
    expect(saved).toMatchObject({
      newCategoryName: "",
      mainCategoryId: CATEGORY,
      subCategoryId: "",
    });
  });
});

describe("move, movePhoto, makeMain", () => {
  it("moves within range and ignores out of range moves", () => {
    expect(move(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(move(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(move(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("moves photos among photos and keeps the video last", () => {
    const media = [tile("a"), tile("b"), tile("v", "video")];
    expect(movePhoto(media, "b", -1).map((t) => t.tileId)).toEqual(["b", "a", "v"]);
    expect(makeMain([tile("a"), tile("b"), tile("c")], "c").map((t) => t.tileId)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
});
