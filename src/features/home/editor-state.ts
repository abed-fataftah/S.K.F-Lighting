// The homepage editor's page state (spec 0011 AC-8 to AC-10). Pure: ticks, ↑ ↓, and the featured
// list change only this state, and "حفظ التغييرات" sends it whole. The dialog saves at once; its
// result is folded into both the page state and the baseline, so it never counts as a change.
import { HOME_LIMITS } from "./home-rules";
import type { SaveHomepageInput } from "./schemas";
import type { EditorBanner, PickerProduct } from "./server/homepage-db";

export type EditorState = {
  readonly banners: readonly EditorBanner[];
  readonly featured: readonly PickerProduct[];
  /** The mains ticked for Home. */
  readonly homeIds: readonly string[];
};

export function editorFrom(data: {
  readonly banners: readonly EditorBanner[];
  readonly featured: readonly PickerProduct[];
  readonly mains: readonly { readonly id: string; readonly showOnHome: boolean }[];
}): EditorState {
  return {
    banners: data.banners,
    featured: data.featured,
    homeIds: data.mains.filter((main) => main.showOnHome).map((main) => main.id),
  };
}

/** What `saveHomepage` gets: the page state in its order, with the version the page holds. */
export function savePayload(state: EditorState, version: number): SaveHomepageInput {
  return {
    version,
    banners: state.banners.map((banner) => ({ id: banner.id, isActive: banner.isActive })),
    featured: state.featured.map((product) => product.id),
    homeCategoryIds: [...state.homeIds],
  };
}

/** What counts as an unsaved change: order, ticks, picks, and Home mains; never the version. */
export function changeKey(state: EditorState): string {
  const payload = savePayload(state, 0);
  return JSON.stringify([payload.banners, payload.featured, [...payload.homeCategoryIds].sort()]);
}

/** The list with the item at `index` moved one step (`-1` up, `1` down); unchanged at an edge. */
export function moveItem<T>(list: readonly T[], index: number, by: -1 | 1): readonly T[] {
  const to = index + by;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export const activeCount = (banners: readonly EditorBanner[]) =>
  banners.filter((banner) => banner.isActive).length;

/** A banner may be ticked while fewer than five are, and always unticked (AC-9). */
export function canTick(banners: readonly EditorBanner[], banner: EditorBanner): boolean {
  return banner.isActive || activeCount(banners) < HOME_LIMITS.maxActiveBanners;
}

export function setActive(state: EditorState, id: string, isActive: boolean): EditorState {
  const banner = state.banners.find((row) => row.id === id);
  if (!banner || (isActive && !canTick(state.banners, banner))) return state;
  return {
    ...state,
    banners: state.banners.map((row) => (row.id === id ? { ...row, isActive } : row)),
  };
}

/** Adds a pick at the end; a repeat or a ninth pick changes nothing (AC-12). */
export function addFeatured(state: EditorState, product: PickerProduct): EditorState {
  if (
    state.featured.length >= HOME_LIMITS.maxFeatured ||
    state.featured.some((row) => row.id === product.id)
  ) {
    return state;
  }
  return { ...state, featured: [...state.featured, product] };
}

export function removeFeatured(state: EditorState, id: string): EditorState {
  return { ...state, featured: state.featured.filter((row) => row.id !== id) };
}

export function setHomeMain(state: EditorState, id: string, shown: boolean): EditorState {
  const without = state.homeIds.filter((homeId) => homeId !== id);
  return { ...state, homeIds: shown ? [...without, id] : without };
}

/**
 * A banner the dialog saved: a new one goes at the end of both lists; an edit replaces its row
 * by id in both, keeping the page's own unsaved tick for it.
 */
export function withSavedBanner(state: EditorState, banner: EditorBanner, keepTick: boolean) {
  const at = state.banners.findIndex((row) => row.id === banner.id);
  if (at === -1) return { ...state, banners: [...state.banners, banner] };
  return {
    ...state,
    banners: state.banners.map((row) =>
      row.id === banner.id
        ? { ...banner, isActive: keepTick ? row.isActive : banner.isActive }
        : row,
    ),
  };
}

export function withoutBanner(state: EditorState, id: string): EditorState {
  return { ...state, banners: state.banners.filter((row) => row.id !== id) };
}
