import { describe, expect, it } from "vitest";
import {
  chooseDraft,
  commitPickerQuantity,
  keepOption,
  NEW_DRAFT,
  pickedOption,
  pickerStart,
  planCatalogAdd,
} from "./catalog-add";
import type { DraftOption } from "./draft-view";

// covers: AC-5, AC-6, AC-7, AC-8, AC-10, AC-11, AC-15 (spec 0021)

const option = (over: Partial<DraftOption> & { id: string }): DraftOption => ({
  code: null,
  sizeLabel: null,
  colourName: null,
  price: 10_000,
  sellable: true,
  archived: false,
  ...over,
});

const sized = [
  option({ id: "a60", sizeLabel: "60 سم", colourName: "ذهبي" }),
  option({ id: "a80", sizeLabel: "80 سم", colourName: "ذهبي", price: 12_000 }),
  option({ id: "a80b", sizeLabel: "80 سم", colourName: "أسود", sellable: false }),
];

describe("planCatalogAdd", () => {
  it("merges into the option's line", () => {
    expect(
      planCatalogAdd({ existing: { position: 3, quantity: 4 }, lineCount: 5, quantity: 2 }),
    ).toEqual({ kind: "merge", quantity: 6, position: 3 });
  });

  it("counts a line with no quantity as 0", () => {
    expect(
      planCatalogAdd({ existing: { position: 1, quantity: null }, lineCount: 1, quantity: 7 }),
    ).toEqual({ kind: "merge", quantity: 7, position: 1 });
  });

  it("allows 999 exactly and refuses 1000 with the line's position and quantity", () => {
    expect(
      planCatalogAdd({ existing: { position: 2, quantity: 990 }, lineCount: 2, quantity: 9 }),
    ).toEqual({ kind: "merge", quantity: 999, position: 2 });
    expect(
      planCatalogAdd({ existing: { position: 2, quantity: 990 }, lineCount: 2, quantity: 10 }),
    ).toEqual({ kind: "quantity_over", position: 2, current: 990 });
  });

  it("appends a line last when the option is not on the draft", () => {
    expect(planCatalogAdd({ existing: null, lineCount: 4, quantity: 1 })).toEqual({
      kind: "append",
      position: 5,
    });
    expect(planCatalogAdd({ existing: null, lineCount: 0, quantity: 1 })).toEqual({
      kind: "append",
      position: 1,
    });
  });

  it("refuses an append at 30 lines, but still merges into a full draft", () => {
    expect(planCatalogAdd({ existing: null, lineCount: 30, quantity: 1 })).toEqual({
      kind: "too_many_lines",
    });
    expect(
      planCatalogAdd({ existing: { position: 30, quantity: 1 }, lineCount: 30, quantity: 1 }),
    ).toEqual({ kind: "merge", quantity: 2, position: 30 });
  });
});

describe("commitPickerQuantity", () => {
  it("takes whole numbers from 1 to 999 in Arabic or Latin digits", () => {
    expect(commitPickerQuantity("1")).toBe(1);
    expect(commitPickerQuantity(" ١٢ ")).toBe(12);
    expect(commitPickerQuantity("999")).toBe(999);
  });

  it("refuses anything else instead of clamping it", () => {
    for (const typed of ["", "0", "1000", "2.5", "-3", "abc", "1e2"]) {
      expect(commitPickerQuantity(typed)).toBeNull();
    }
  });
});

describe("pickerStart", () => {
  it("keeps the page's option when it is listed and sellable", () => {
    expect(pickerStart(sized, "a80", 3)).toEqual({
      size: "80 سم",
      colour: "ذهبي",
      quantity: "3",
    });
  });

  it("chooses nothing when the page's option is missing or not sellable", () => {
    expect(pickerStart(sized, "a80b", 1)).toEqual({
      size: undefined,
      colour: undefined,
      quantity: "1",
    });
    expect(pickerStart(sized, "gone", 2).size).toBeUndefined();
    expect(pickerStart(sized, null, 1).size).toBeUndefined();
  });

  it("still settles a product with a single option at once", () => {
    const single = [option({ id: "only" })];
    const start = pickerStart(single, null, 1);
    expect(pickedOption(single, start)?.id).toBe("only");
  });
});

describe("keepOption after a reload", () => {
  it("clears an option that is no longer sellable", () => {
    expect(keepOption(sized, "a60")).toEqual({ size: "60 سم", colour: "ذهبي" });
    expect(keepOption(sized, "a80b")).toEqual({ size: undefined, colour: undefined });
  });
});

describe("chooseDraft", () => {
  const drafts = [{ id: "newest" }, { id: "older" }];

  it("starts on the newest draft, or the new draft row when there are none", () => {
    expect(chooseDraft(drafts, null, false)).toBe("newest");
    expect(chooseDraft([], null, false)).toBe(NEW_DRAFT);
  });

  it("keeps the chosen draft while it is listed, else falls back to the newest", () => {
    expect(chooseDraft(drafts, "older", false)).toBe("older");
    expect(chooseDraft(drafts, "deleted", false)).toBe("newest");
    expect(chooseDraft([], "deleted", false)).toBe(NEW_DRAFT);
  });

  it("keeps the new draft row only while under 30 drafts", () => {
    expect(chooseDraft(drafts, NEW_DRAFT, false)).toBe(NEW_DRAFT);
    expect(chooseDraft(drafts, NEW_DRAFT, true)).toBe("newest");
  });
});
