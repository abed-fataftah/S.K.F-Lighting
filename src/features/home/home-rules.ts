// The homepage rules (spec 0011): the caps, the live link rule, the category circles and their
// lines, the featured badges, and the save plans. Pure, so Home, the editor, the actions, and the
// tests all share one answer.
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
  /** Circles at or above this count turn the still row into the carousel (AC-4). */
  carouselFrom: 4,
  /** Circle names the section subline lists (AC-4). */
  sublineNames: 6,
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

// ---- Category circles (AC-4) -----------------------------------------------------------------

export type HomeCategoryRow = NavCategory & {
  readonly showOnHome: boolean;
  readonly homeSubtitle: string | null;
  readonly imageKey: string | null;
};

export type HomeCircle = {
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
 * The circles: the mains the menu lists (shown, with a listed product), ticked for Home, in
 * category order. The line is the owner's, else built from the main's menu subs.
 */
export function buildHomeCircles(
  rows: readonly HomeCategoryRow[],
  listed: ReadonlyMap<string, number>,
): readonly HomeCircle[] {
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

/** The section subline: the first six circle names. */
export function circleSubline(circles: readonly HomeCircle[]): string {
  return circles
    .slice(0, HOME_LIMITS.sublineNames)
    .map((circle) => circle.name)
    .join("، ");
}

/** Where "تسوّق الآن" goes: the circles, else the featured products, else nowhere (hidden). */
export function shopNowTarget(
  circleCount: number,
  featuredCount: number,
): "categories" | "featured" | null {
  if (circleCount > 0) return "categories";
  return featuredCount > 0 ? "featured" : null;
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
