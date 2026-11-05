import { describe, expect, it } from "vitest";
import {
  addFeatured,
  canTick,
  changeKey,
  editorFrom,
  moveItem,
  removeFeatured,
  savePayload,
  setActive,
  setHomeMain,
  withSavedBanner,
  withoutBanner,
  type EditorState,
} from "./editor-state";
import type { EditorBanner, PickerProduct } from "./server/homepage-db";

const banner = (id: string, isActive = true): EditorBanner => ({
  id,
  imageKey: `banners/${id}.webp`,
  alt: `بانر ${id}`,
  isActive,
  link: null,
});
const pick = (id: string): PickerProduct => ({
  id,
  name: `منتج ${id}`,
  code: id.toUpperCase(),
  imageKey: null,
  badge: null,
});

const state = (fields: Partial<EditorState> = {}): EditorState => ({
  banners: [banner("b1"), banner("b2", false)],
  featured: [pick("p1")],
  homeIds: ["m1", "m2"],
  ...fields,
});

// covers: AC-8, AC-9, AC-10, AC-12 (spec 0011)
describe("homepage editor state", () => {
  it("opens with the mains ticked that show on Home", () => {
    const opened = editorFrom({
      banners: [],
      featured: [],
      mains: [
        { id: "m1", showOnHome: true },
        { id: "m2", showOnHome: false },
      ],
    });
    expect(opened.homeIds).toEqual(["m1"]);
  });

  it("sends the page's order, ticks, and picks with the version it holds", () => {
    expect(savePayload(state(), 7)).toEqual({
      version: 7,
      banners: [
        { id: "b1", isActive: true },
        { id: "b2", isActive: false },
      ],
      featured: ["p1"],
      homeCategoryIds: ["m1", "m2"],
    });
  });

  it("moves a row one step and stays put at either edge", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    const list = ["a", "b"];
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 1, 1)).toBe(list);
  });

  it("refuses a sixth active tick and always allows an untick", () => {
    const five = [1, 2, 3, 4, 5].map((n) => banner(`b${n}`));
    const page = state({ banners: [...five, banner("b6", false)] });
    expect(canTick(page.banners, page.banners[5])).toBe(false);
    expect(setActive(page, "b6", true)).toBe(page);
    expect(setActive(page, "b1", false).banners[0].isActive).toBe(false);
  });

  it("adds a pick once, at the end, up to eight", () => {
    expect(addFeatured(state(), pick("p2")).featured.map((p) => p.id)).toEqual(["p1", "p2"]);
    const page = state();
    expect(addFeatured(page, pick("p1"))).toBe(page);
    const eight = state({ featured: Array.from({ length: 8 }, (_, i) => pick(`p${i}`)) });
    expect(addFeatured(eight, pick("p9"))).toBe(eight);
    expect(removeFeatured(state(), "p1").featured).toEqual([]);
  });

  it("ticks and unticks a main for Home", () => {
    expect(setHomeMain(state(), "m1", false).homeIds).toEqual(["m2"]);
    expect(setHomeMain(state(), "m3", true).homeIds).toEqual(["m1", "m2", "m3"]);
  });

  it("counts order, ticks, picks, and mains as changes, but not the main order", () => {
    const page = state();
    expect(changeKey(setHomeMain(setHomeMain(page, "m1", false), "m1", true))).toBe(
      changeKey(page),
    );
    expect(changeKey(setActive(page, "b2", true))).not.toBe(changeKey(page));
    expect(changeKey({ ...page, banners: moveItem(page.banners, 0, 1) })).not.toBe(changeKey(page));
  });

  it("folds a dialog save into the page without making it a change", () => {
    const page = setActive(state(), "b2", true);
    const baseline = state();
    const edited = { ...banner("b2", false), alt: "عنوان جديد" };

    const nextPage = withSavedBanner(page, edited, true);
    const nextBaseline = withSavedBanner(baseline, edited, false);
    // The edit replaces the row by id; the page keeps its own unsaved tick.
    expect(nextPage.banners[1]).toEqual({ ...edited, isActive: true });
    expect(nextBaseline.banners[1]).toEqual(edited);

    const created = banner("b3", false);
    const pageWithNew = withSavedBanner(nextPage, created, true);
    const baselineWithNew = withSavedBanner(nextBaseline, created, false);
    expect(pageWithNew.banners.map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
    // The only change left is the tick typed before the dialog opened.
    expect(changeKey(setActive(pageWithNew, "b2", false))).toBe(changeKey(baselineWithNew));
  });

  it("drops a deleted banner from the page", () => {
    expect(withoutBanner(state(), "b1").banners.map((b) => b.id)).toEqual(["b2"]);
  });
});
