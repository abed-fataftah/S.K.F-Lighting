// The homepage rules (spec 0011): the caps, the live link rule, the category cards and their
// lines (spec 0031), the featured badges, and the save plans. Pure, so Home, the editor, the
// actions, and the tests all share one answer.
import type { CardProduct } from "@/features/catalog/card-view";
import {
  buildNavigation,
  isCategoryShown,
  type NavCategory,
} from "@/features/catalog/category-rules";
import { routes } from "@/lib/routes";

export const HOME_LIMITS = {
  /** Banners stored at once (AC-10). */
  maxBanners: 10,
  /** Banners active at once, and so the most Home ever shows (AC-2, AC-9). */
  maxActiveBanners: 5,
  /** Featured picks (AC-12). */
  maxFeatured: 8,
  /** Products the category cards' grid shows for the selected category (spec 0031 AC-6). */
  categoryProducts: 8,
} as const;

// ---- Banner links (AC-10) --------------------------------------------------------------------

type Shown = { readonly slug: string; readonly name: string; readonly isVisible: boolean };

/** What a banner points at, read with its target rows. A product's `listed` is the SQL rule. */
export type BannerTarget =
  | ({ readonly kind: "category"; readonly id: string; readonly parent: Shown | null } & Shown)
  | {
      readonly kind: "product";
      readonly id: string;
      readonly slug: string;
      readonly name: string;
      readonly listed: boolean;
    };

/** Live: a shown category (spec 0008 AC-6) or a listed product (spec 0008 AC-7). */
export function isTargetLive(target: BannerTarget): boolean {
  return target.kind === "category" ? isCategoryShown(target, target.parent) : target.listed;
}

/** The address a live banner opens. */
export function targetHref(target: BannerTarget): string {
  if (target.kind === "product") return routes.product(target.slug);
  return target.parent
    ? routes.subcategory(target.parent.slug, target.slug)
    : routes.category(target.slug);
}

/** The editor's link name: a sub as "<main> › <sub>". */
export function targetLabel(target: BannerTarget): string {
  return target.kind === "category" && target.parent
    ? `${target.parent.name} › ${target.name}`
    : target.name;
}

/** Home links a banner only while its target is live; otherwise it is a plain picture. */
export function bannerHref(target: BannerTarget | null): string | null {
  return target && isTargetLive(target) ? targetHref(target) : null;
}

// ---- Category cards (spec 0031 AC-2) ---------------------------------------------------------

export type HomeCategoryRow = NavCategory & {
  readonly showOnHome: boolean;
  readonly homeSubtitle: string | null;
  readonly imageKey: string | null;
};

export type HomeCategory = {
  readonly slug: string;
  readonly name: string;
  readonly imageKey: string | null;
  readonly line: string | null;
};

/** "أ"، "أ و ب"، "أ، ب و ج": the first three names; null with none. */
export function joinSubNames(names: readonly string[]): string | null {
  const [a, b, c] = names;
  if (a === undefined) return null;
  if (b === undefined) return a;
  if (c === undefined) return `${a} و ${b}`;
  return `${a}، ${b} و ${c}`;
}

/**
 * The cards: the mains the menu lists (shown, with a listed product), ticked for Home, in category
 * order. The line is the owner's, else built from the main's menu subs. The route that answers a
 * card's products checks against this same list (spec 0031 AC-7).
 */
export function buildHomeCategories(
  rows: readonly HomeCategoryRow[],
  listed: ReadonlyMap<string, number>,
): readonly HomeCategory[] {
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  return buildNavigation(rows, listed).flatMap((main) => {
    const row = bySlug.get(main.slug);
    if (!row?.showOnHome) return [];
    return [
      {
        slug: main.slug,
        name: main.name,
        imageKey: row.imageKey,
        line: row.homeSubtitle ?? joinSubNames(main.subs.map((sub) => sub.name)),
      },
    ];
  });
}

/** The line Home would build for a main from its menu subs, shown as the dialog's hint (AC-11). */
export function builtCircleLines(
  rows: readonly NavCategory[],
  listed: ReadonlyMap<string, number>,
): ReadonlyMap<string, string | null> {
  return new Map(
    buildNavigation(rows, listed).map((main) => [
      main.slug,
      joinSubNames(main.subs.map((sub) => sub.name)),
    ]),
  );
}

/**
 * Where card `index` sits in the hero coverflow (spec 0030) while card `centre` is in the middle:
 * its signed steps from the centre, positive toward the inline end. The far half wraps to the start
 * side, so with 2 cards the other one always waits on the end side and with 3 one sits on each side.
 */
export function circleSteps(index: number, centre: number, count: number): number {
  const raw = (((index - centre) % count) + count) % count;
  return raw > count / 2 ? raw - count : raw;
}

/** A coverflow step that moves a card from one side of the centre to the other: it fades across
 * (spec 0030 AC-7). */
export const changesSide = (before: number, after: number): boolean => before * after < 0;

/** Where "تسوّق الآن" goes: the category cards, else nowhere (hidden) (spec 0030 AC-3, AC-11). */
export function shopNowTarget(categoryCount: number): "categories" | null {
  return categoryCount > 0 ? "categories" : null;
}

/** The card selected when Home opens: the first in the owner's order; null with none (AC-2). */
export function firstCategory(categories: readonly HomeCategory[]): HomeCategory | null {
  return categories[0] ?? null;
}

/**
 * Which way card `index` turns at rest while card `selected` is pressed (AC-5): -1, 0, or 1, the
 * sign of its `rotateY`. Only the cards in the selected card's own visual row turn (`perRow` cards
 * a row; on a phone the whole list is one row); they face it, as the coverflow's side cards face
 * the centre: a card on the physical right gets a negative angle, one on the physical left a
 * positive one. `dir` is 1 in left to right and -1 in right to left. The component passes 1 and
 * lets the CSS multiply by `--cf-dir`, so the server markup is right in both directions.
 */
export function categoryTurn(
  index: number,
  selected: number,
  perRow: number,
  dir: Dir,
): -1 | 0 | 1 {
  const row = Math.max(1, perRow);
  if (index === selected || Math.floor(index / row) !== Math.floor(selected / row)) return 0;
  return dir * Math.sign(index - selected) > 0 ? -1 : 1;
}

/**
 * The card a key selects (AC-3): the left arrow the card on the physical left, the right arrow the
 * one on the physical right (the rule of `stepForKey`), Home the first, End the last, wrapping at
 * the ends. Null for any other key.
 */
export function indexForKey(key: string, index: number, count: number, dir: Dir): number | null {
  if (count < 1) return null;
  const wrap = (at: number) => ((at % count) + count) % count;
  if (key === "ArrowLeft") return wrap(index - dir);
  if (key === "ArrowRight") return wrap(index + dir);
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

// ---- The category grid's cache (spec 0031 AC-7, AC-8) ------------------------------------------

/** What the page knows of one category's eight products. */
export type CategoryEntry =
  | { readonly kind: "ready"; readonly products: readonly CardProduct[] }
  | { readonly kind: "loading" }
  | { readonly kind: "failed" };

export type CategoryCache = ReadonlyMap<string, CategoryEntry>;

export type CategoryCacheAction =
  | { readonly type: "start"; readonly slug: string }
  | { readonly type: "done"; readonly slug: string; readonly products: readonly CardProduct[] }
  | { readonly type: "fail"; readonly slug: string };

/** The seed: the page's own eight for the first category, or a failed entry when that read failed. */
export function seedCategoryCache(
  first: HomeCategory | null,
  products: readonly CardProduct[] | null,
): CategoryCache {
  if (!first) return new Map();
  const entry: CategoryEntry = products ? { kind: "ready", products } : { kind: "failed" };
  return new Map([[first.slug, entry]]);
}

/** A category is fetched when nothing is known of it, or its last fetch failed (a retry). */
export const needsFetch = (entry: CategoryEntry | undefined): boolean =>
  entry === undefined || entry.kind === "failed";

/**
 * One answer per slug for the component's lifetime: a ready entry never changes; a fetch starts
 * only for an unknown or failed slug; an answer is stored whether or not its card is still the
 * selected one (the panel reads the selected slug only, so a late answer never replaces it).
 */
export function categoryCacheReducer(
  cache: CategoryCache,
  action: CategoryCacheAction,
): CategoryCache {
  const entry = cache.get(action.slug);
  if (entry?.kind === "ready") return cache;
  if (action.type === "start" && !needsFetch(entry)) return cache;
  const next: CategoryEntry =
    action.type === "done"
      ? { kind: "ready", products: action.products }
      : { kind: action.type === "start" ? "loading" : "failed" };
  return new Map(cache).set(action.slug, next);
}

/** What the panel shows for the selected category (AC-6, AC-7, AC-8). */
export function categoryPanelState(
  entry: CategoryEntry | undefined,
): "grid" | "skeleton" | "notice" | "empty" {
  if (entry === undefined || entry.kind === "loading") return "skeleton";
  if (entry.kind === "failed") return "notice";
  return entry.products.length ? "grid" : "empty";
}

// ---- Hero coverflow (spec 0030) ----------------------------------------------------------------

/** The hero: the coverflow with one or more products, else the fallback card (AC-2, AC-11). */
export function heroChoice(featured: readonly unknown[] | null): "coverflow" | "card" {
  return featured && featured.length > 0 ? "coverflow" : "card";
}

/** How many neighbours show on each side: one below lg, two from lg (AC-4). */
export type CoverflowVisible = 1 | 2;

/** +1 in left to right, -1 in right to left: the physical direction of the inline end. */
export type Dir = 1 | -1;

// The geometry table of spec 0030 (Feature design), by steps away from the centre. The last entry
// is the "next out" place, where a card waits hidden and slides in from; anything further sits
// there too. The 0.80 offset at md is folded into 0.78 (within the 10% tuning the spec allows).
const COVERFLOW = {
  1: {
    offset: [0, 0.78, 1.4],
    scale: [1, 0.74, 0.56],
    angle: [0, 35, 45],
    opacity: [1, 0.75, 0],
    tint: [0, 0.3, 0.5],
  },
  2: {
    offset: [0, 0.82, 1.4, 1.9],
    scale: [1, 0.74, 0.56, 0.42],
    angle: [0, 35, 45, 50],
    opacity: [1, 0.75, 0.5, 0],
    tint: [0, 0.3, 0.5, 0.5],
  },
} as const;

export type CoverflowPlacement = {
  /** The move along the line as a multiple of the card width, positive toward the physical right. */
  readonly x: number;
  /** `rotateY` in degrees; the minus turns a card's inner edge back so it faces the centre. */
  readonly angle: number;
  readonly scale: number;
  readonly opacity: number;
  /** The black overlay's opacity. */
  readonly tint: number;
  /** Falls by one per step away, so nearer cards stack above. */
  readonly z: number;
  /** Beyond the visible neighbours: at the next out place, invisible and untouchable. */
  readonly hidden: boolean;
};

/**
 * Where a card `steps` from the centre sits (AC-4). `dir` turns the inline steps into a physical
 * side: with `dir` 1 the values are "toward the inline end" and the CSS multiplies by the
 * direction; with the real `dir` they are physical, for the crossing fade keyframes.
 */
export function coverflowPlacement(
  steps: number,
  visible: CoverflowVisible,
  dir: Dir,
): CoverflowPlacement {
  const geometry = COVERFLOW[visible];
  const away = Math.min(Math.abs(steps), visible + 1);
  const side = dir * Math.sign(steps);
  // `|| 0` turns the centre's -0 (a zero side) into a plain 0.
  return {
    x: side * geometry.offset[away] || 0,
    angle: -side * geometry.angle[away] || 0,
    scale: geometry.scale[away],
    opacity: geometry.opacity[away],
    tint: geometry.tint[away],
    z: 10 - away,
    hidden: away > visible,
  };
}

export type KeyPress = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
};

/**
 * The step an arrow key makes (AC-6): the left key brings the card on the physical left to the
 * centre, the right key the card on the physical right, in both directions. A key with a modifier
 * is the browser's. Null is no step.
 */
export function stepForKey(press: KeyPress, dir: Dir): 1 | -1 | null {
  if (press.ctrlKey || press.altKey || press.metaKey || press.shiftKey) return null;
  // The physical left card is the inline start in left to right (-1), the inline end in right to left.
  if (press.key === "ArrowLeft") return dir === 1 ? -1 : 1;
  if (press.key === "ArrowRight") return dir;
  return null;
}

export const COVERFLOW_SWIPE = {
  /** A pointer move this far sideways (and more sideways than up and down) is a swipe (AC-6). */
  step: 40,
  /** A move this far sideways cancels the click that follows, so a drag never opens or taps. */
  tap: 10,
} as const;

/** The step a pointer move makes: the cards follow the finger, so a move to the right brings the
 * physical left card in. 0 is no step (too short, or more up and down than sideways). */
export function swipeStep(dx: number, dy: number, dir: Dir): 1 | -1 | 0 {
  if (Math.abs(dx) < COVERFLOW_SWIPE.step || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx > 0 ? (dir === 1 ? -1 : 1) : dir;
}

// ---- Featured products (AC-5, AC-8) ----------------------------------------------------------

export type FeaturedBadge = "archived" | "hidden" | "category_hidden" | "out_of_stock";

/** Why a pick will not show on Home, or shows out of stock; null when it shows to buy. */
export function featuredBadge(product: {
  readonly status: "active" | "hidden" | "archived";
  readonly categoryShown: boolean;
  readonly inStock: boolean;
}): FeaturedBadge | null {
  if (product.status === "archived") return "archived";
  if (product.status === "hidden") return "hidden";
  if (!product.categoryShown) return "category_hidden";
  return product.inStock ? null : "out_of_stock";
}

// ---- Saves (AC-9, AC-10) ---------------------------------------------------------------------

/** A write sent with another version than the stored one changes nothing (AC-9). */
export const isStale = (stored: number, sent: number): boolean => stored !== sent;

export type NewBannerPlan =
  | { readonly kind: "too_many_banners" }
  | { readonly kind: "insert"; readonly sort: number; readonly isActive: boolean };

/** A new banner goes last, active while fewer than five are (AC-10). */
export function planNewBanner(stored: {
  readonly count: number;
  readonly activeCount: number;
  readonly maxSort: number | null;
}): NewBannerPlan {
  if (stored.count >= HOME_LIMITS.maxBanners) return { kind: "too_many_banners" };
  return {
    kind: "insert",
    sort: stored.maxSort === null ? 0 : stored.maxSort + 1,
    isActive: stored.activeCount < HOME_LIMITS.maxActiveBanners,
  };
}

export type HomepageSave = {
  readonly version: number;
  readonly banners: readonly { readonly id: string; readonly isActive: boolean }[];
  readonly featured: readonly string[];
  readonly homeCategoryIds: readonly string[];
};

export type HomepageSavePlan =
  | { readonly kind: "stale" | "too_many_active" | "too_many_featured" | "invalid" }
  | { readonly kind: "product_unavailable"; readonly productIds: readonly string[] }
  | {
      readonly kind: "save";
      readonly banners: readonly {
        readonly id: string;
        readonly sort: number;
        readonly isActive: boolean;
      }[];
      readonly featured: readonly { readonly productId: string; readonly sort: number }[];
    };

const hasRepeats = (ids: readonly string[]) => new Set(ids).size !== ids.length;

/**
 * The page save (AC-9) against what is stored under the lock: the version, the banner ids (the
 * page must hold exactly these), and the status of each sent product (missing when deleted).
 * Order and sort come from the page's lists; a hidden pick is allowed, an archived one is not.
 */
export function planHomepageSave(
  stored: {
    readonly version: number;
    readonly bannerIds: readonly string[];
    readonly productStatus: ReadonlyMap<string, "active" | "hidden" | "archived">;
  },
  input: HomepageSave,
): HomepageSavePlan {
  if (isStale(stored.version, input.version)) return { kind: "stale" };
  const sent = input.banners.map((banner) => banner.id);
  const storedIds = new Set(stored.bannerIds);
  if (hasRepeats(sent) || sent.length !== storedIds.size || sent.some((id) => !storedIds.has(id))) {
    return { kind: "stale" };
  }
  if (hasRepeats(input.featured) || hasRepeats(input.homeCategoryIds)) return { kind: "invalid" };
  if (input.banners.filter((banner) => banner.isActive).length > HOME_LIMITS.maxActiveBanners) {
    return { kind: "too_many_active" };
  }
  if (input.featured.length > HOME_LIMITS.maxFeatured) return { kind: "too_many_featured" };
  const unavailable = input.featured.filter((id) => {
    const status = stored.productStatus.get(id);
    return status === undefined || status === "archived";
  });
  if (unavailable.length) return { kind: "product_unavailable", productIds: unavailable };
  return {
    kind: "save",
    banners: input.banners.map((banner, sort) => ({
      id: banner.id,
      sort,
      isActive: banner.isActive,
    })),
    featured: input.featured.map((productId, sort) => ({ productId, sort })),
  };
}
