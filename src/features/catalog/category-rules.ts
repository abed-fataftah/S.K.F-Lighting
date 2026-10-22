// The category rules (spec 0008): order, shown, navigation, the reorder plan, and the slug base.
// Pure, so the dashboard, the storefront reads, and their tests all share one answer.
import { slugify } from "./slug";

/** The slug base when a name has no letters or digits to keep (AC-2). */
export const FALLBACK_CATEGORY_SLUG = "qism";

/** `slugify(name)`, or `qism` when nothing is left. `nextFreeSlug` then adds `-2`, `-3` on a clash. */
export function categorySlugBase(name: string): string {
  return slugify(name) || FALLBACK_CATEGORY_SLUG;
}

/** Sibling names compare like `lower(btrim(name))` in SQL; stored names are already tidied. */
export function categoryNameKey(name: string): string {
  return name.trim().toLowerCase();
}

type Ordered = { readonly id: string; readonly name: string; readonly sort: number };

/** Category order everywhere (AC-4): `sort`, then `name`, then `id`. */
export function compareCategories(a: Ordered, b: Ordered): number {
  if (a.sort !== b.sort) return a.sort - b.sort;
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function inCategoryOrder<T extends Ordered>(rows: readonly T[]): readonly T[] {
  return [...rows].sort(compareCategories);
}

type Visible = { readonly isVisible: boolean };

/**
 * A main is shown when it is visible; a sub when it and its main both are (AC-6). Hiding a main
 * never writes its subs' flags, so showing it again brings back the subs that were showing.
 */
export function isCategoryShown(category: Visible, parent: Visible | null): boolean {
  return category.isVisible && (parent === null || parent.isVisible);
}

export type MoveDirection = "up" | "down";

export type MovePlan =
  | {
      readonly kind: "move";
      readonly sorts: readonly { readonly id: string; readonly sort: number }[];
    }
  | { readonly kind: "at_edge" }
  | { readonly kind: "not_found" };

/**
 * One step up or down among siblings (AC-4): renumber them `0..n-1` in category order, swap the
 * category with its neighbour, and return only the rows whose `sort` changes. Equal sorts left by
 * the import still move one step, and no two siblings ever share a sort afterwards.
 */
export function planMove<T extends Ordered>(
  siblings: readonly T[],
  id: string,
  direction: MoveDirection,
): MovePlan {
  const ordered = inCategoryOrder(siblings);
  const at = ordered.findIndex((row) => row.id === id);
  if (at === -1) return { kind: "not_found" };
  const to = direction === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= ordered.length) return { kind: "at_edge" };

  const next = [...ordered];
  [next[at], next[to]] = [next[to], next[at]];
  const sorts = next
    .map((row, sort) => ({ id: row.id, sort, before: row.sort }))
    .filter((row) => row.sort !== row.before)
    .map(({ id: rowId, sort }) => ({ id: rowId, sort }));
  return { kind: "move", sorts };
}

/** One category as the storefront needs it to build navigation. */
export type NavCategory = Ordered & {
  readonly slug: string;
  readonly parentId: string | null;
  readonly isVisible: boolean;
};

export type NavSub = {
  readonly slug: string;
  readonly name: string;
  readonly productCount: number;
};

export type NavMain = NavSub & { readonly subs: readonly NavSub[] };

/**
 * Navigation (AC-14): shown categories with at least one listed product, in category order. A
 * main counts its own listed products plus its shown subs'. `listed` maps a category id to the
 * listed products placed directly on it.
 */
export function buildNavigation(
  rows: readonly NavCategory[],
  listed: ReadonlyMap<string, number>,
): readonly NavMain[] {
  const ordered = inCategoryOrder(rows);
  return ordered
    .filter((main) => main.parentId === null && main.isVisible)
    .map((main) => {
      const subs = ordered
        .filter((sub) => sub.parentId === main.id && isCategoryShown(sub, main))
        .map((sub) => ({ slug: sub.slug, name: sub.name, productCount: listed.get(sub.id) ?? 0 }));
      const productCount =
        (listed.get(main.id) ?? 0) + subs.reduce((sum, sub) => sum + sub.productCount, 0);
      return {
        slug: main.slug,
        name: main.name,
        productCount,
        subs: subs.filter((sub) => sub.productCount > 0),
      };
    })
    .filter((main) => main.productCount > 0);
}

export type PageCategory = NavCategory & { readonly description: string | null };

export type CategoryPageScope = {
  readonly main: PageCategory;
  readonly sub: PageCategory | null;
  /** The categories whose listed products the page shows: the sub, or the main and its shown subs. */
  readonly categoryIds: readonly string[];
  /** M: the listed products on the page (AC-10). */
  readonly total: number;
  /** The main's navigation subs: the subline and the chips (AC-9). */
  readonly navSubs: readonly NavSub[];
  /** The chips after "الكل": the navigation subs, plus the current sub when it is outside them. */
  readonly chipSubs: readonly NavSub[];
};

/**
 * Which category `/c/<main>` or `/c/<main>/<sub>` opens (AC-8), or null for the not found page: an
 * unknown slug, a category not shown, a sub under another main, or a sub's slug used as a main.
 */
export function resolveCategoryPage(
  rows: readonly PageCategory[],
  listed: ReadonlyMap<string, number>,
  mainSlug: string,
  subSlug: string | null,
): CategoryPageScope | null {
  const main = rows.find((row) => row.slug === mainSlug && row.parentId === null);
  if (!main || !isCategoryShown(main, null)) return null;
  const sub = subSlug === null ? null : rows.find((row) => row.slug === subSlug);
  if (subSlug !== null && (!sub || sub.parentId !== main.id || !isCategoryShown(sub, main))) {
    return null;
  }

  const shownSubs = inCategoryOrder(
    rows.filter((row) => row.parentId === main.id && isCategoryShown(row, main)),
  );
  const count = (id: string) => listed.get(id) ?? 0;
  const asNav = (row: PageCategory): NavSub => ({
    slug: row.slug,
    name: row.name,
    productCount: count(row.id),
  });
  const navSubs = shownSubs.filter((row) => count(row.id) > 0).map(asNav);
  const categoryIds = sub ? [sub.id] : [main.id, ...shownSubs.map((row) => row.id)];
  const chipSubs =
    sub && !navSubs.some((nav) => nav.slug === sub.slug)
      ? shownSubs.filter((row) => count(row.id) > 0 || row.id === sub.id).map(asNav)
      : navSubs;

  return {
    main,
    sub: sub ?? null,
    categoryIds,
    total: categoryIds.reduce((sum, id) => sum + count(id), 0),
    navSubs,
    chipSubs,
  };
}

export type AdminCategoryRow = Ordered & {
  readonly parentId: string | null;
  readonly description: string | null;
  readonly isVisible: boolean;
};

export type CategoryProductCounts = {
  /** Products not `archived` placed directly on the category. */
  readonly live: number;
  /** Products in any status placed directly on it (they block a delete). */
  readonly all: number;
};

export type AdminSub = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly isVisible: boolean;
  readonly productCount: number;
  readonly canDelete: boolean;
};

export type AdminMain = AdminSub & { readonly subs: readonly AdminSub[] };

/**
 * The categories page (AC-1): mains in category order, each with its subs. A main counts its own
 * products not archived plus its subs'. A category can be deleted only with no product in any
 * status and, for a main, no sub (AC-5).
 */
export function buildAdminCategories(
  rows: readonly AdminCategoryRow[],
  counts: ReadonlyMap<string, CategoryProductCounts>,
): readonly AdminMain[] {
  const ordered = inCategoryOrder(rows);
  const countOf = (id: string) => counts.get(id) ?? { live: 0, all: 0 };
  return ordered
    .filter((row) => row.parentId === null)
    .map((main) => {
      const subs = ordered
        .filter((row) => row.parentId === main.id)
        .map((sub) => ({
          id: sub.id,
          name: sub.name,
          description: sub.description,
          isVisible: sub.isVisible,
          productCount: countOf(sub.id).live,
          canDelete: countOf(sub.id).all === 0,
        }));
      return {
        id: main.id,
        name: main.name,
        description: main.description,
        isVisible: main.isVisible,
        productCount: countOf(main.id).live + subs.reduce((sum, sub) => sum + sub.productCount, 0),
        canDelete: countOf(main.id).all === 0 && subs.length === 0,
        subs,
      };
    });
}
