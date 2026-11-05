import "server-only";
import { and, asc, count, eq, inArray, isNull, max, ne, notInArray, or, sql } from "drizzle-orm";
import { escapeLike } from "@/features/catalog/admin-list";
import {
  categoryShown,
  listedInStock,
  parentCategory,
} from "@/features/catalog/server/storefront-sql";
import { isForeignKeyViolation } from "@/server/db/pg-error";
import {
  banners,
  categories,
  featuredProducts,
  productMedia,
  products,
  shopSettings,
} from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import {
  featuredBadge,
  isStale,
  isTargetLive,
  planHomepageSave,
  planNewBanner,
  targetLabel,
  type FeaturedBadge,
  type HomepageSave,
} from "../home-rules";
import type { BannerLink, SaveBannerData } from "../schemas";
import { readBannerRows, type BannerRow } from "./banner-rows";

// The homepage writes (spec 0011 AC-9, AC-10). Every one runs in one transaction that first locks
// the `shop_settings` row and compares `home_version`, so two tabs never overwrite each other and
// the 10 stored and 5 active caps are counted under the same lock. Each bumps the version once.

type Db = Database | Transaction;
type Tx = Transaction;

export type EditorLink = {
  readonly kind: "category" | "product";
  readonly id: string;
  readonly label: string;
  readonly live: boolean;
};

export type EditorBanner = {
  readonly id: string;
  readonly imageKey: string;
  readonly alt: string;
  readonly isActive: boolean;
  /** Null for no link, including after its target was deleted (the FK cleared it). */
  readonly link: EditorLink | null;
};

export function toEditorBanner(row: BannerRow): EditorBanner {
  return {
    id: row.id,
    imageKey: row.imageKey,
    alt: row.alt,
    isActive: row.isActive,
    link: row.target
      ? {
          kind: row.target.kind,
          id: row.target.id,
          label: targetLabel(row.target),
          live: isTargetLive(row.target),
        }
      : null,
  };
}

async function lockVersion(tx: Tx): Promise<number> {
  const [row] = await tx
    .select({ version: shopSettings.homeVersion })
    .from(shopSettings)
    .where(eq(shopSettings.id, 1))
    .for("update");
  if (!row) throw new Error("shop_settings row is missing");
  return row.version;
}

async function bumpVersion(tx: Tx): Promise<number> {
  const [row] = await tx
    .update(shopSettings)
    .set({ homeVersion: sql`${shopSettings.homeVersion} + 1` })
    .where(eq(shopSettings.id, 1))
    .returning({ version: shopSettings.homeVersion });
  return row.version;
}

const linkColumns = (link: BannerLink) => ({
  linkCategoryId: link.kind === "category" ? link.id : null,
  linkProductId: link.kind === "product" ? link.id : null,
});

async function targetExists(tx: Tx, link: BannerLink): Promise<boolean> {
  if (link.kind === "none") return true;
  const table = link.kind === "category" ? categories : products;
  const [row] = await tx.select({ id: table.id }).from(table).where(eq(table.id, link.id));
  return row !== undefined;
}

export type SaveBannerOutcome =
  | { readonly kind: "stale" | "not_found" | "too_many_banners" | "link_not_found" }
  | {
      readonly kind: "saved";
      readonly banner: EditorBanner;
      readonly version: number;
      readonly created: boolean;
      /** The picture this edit replaced, to remove from Storage after commit. */
      readonly replacedKey: string | null;
    };

/** Creates (no `id`) or edits one banner (AC-10). A new one goes last; active while under five. */
export async function saveBannerInDb(db: Db, data: SaveBannerData): Promise<SaveBannerOutcome> {
  try {
    return await db.transaction(async (tx): Promise<SaveBannerOutcome> => {
      if (isStale(await lockVersion(tx), data.version)) return { kind: "stale" };
      if (!(await targetExists(tx, data.link))) return { kind: "link_not_found" };

      let id = data.id;
      let replacedKey: string | null = null;
      if (id) {
        const [old] = await tx
          .select({ imageKey: banners.imageKey })
          .from(banners)
          .where(eq(banners.id, id))
          .for("update");
        if (!old) return { kind: "not_found" };
        replacedKey = old.imageKey === data.imageKey ? null : old.imageKey;
        await tx
          .update(banners)
          .set({ imageKey: data.imageKey, alt: data.alt, ...linkColumns(data.link) })
          .where(eq(banners.id, id));
      } else {
        const [stats] = await tx
          .select({
            count: count(),
            activeCount: sql<number>`count(*) filter (where ${banners.isActive})`.mapWith(Number),
            maxSort: max(banners.sort),
          })
          .from(banners);
        const plan = planNewBanner(stats);
        if (plan.kind === "too_many_banners") return plan;
        const [created] = await tx
          .insert(banners)
          .values({
            imageKey: data.imageKey,
            alt: data.alt,
            ...linkColumns(data.link),
            sort: plan.sort,
            isActive: plan.isActive,
          })
          .returning({ id: banners.id });
        id = created.id;
      }

      const version = await bumpVersion(tx);
      const [row] = await readBannerRows(tx, { id });
      return {
        kind: "saved",
        banner: toEditorBanner(row),
        version,
        created: !data.id,
        replacedKey,
      };
    });
  } catch (error) {
    // The target was deleted between the check and the write.
    if (isForeignKeyViolation(error)) return { kind: "link_not_found" };
    throw error;
  }
}

export type DeleteBannerOutcome =
  | { readonly kind: "stale" | "not_found" }
  | { readonly kind: "deleted"; readonly version: number; readonly imageKey: string };

export async function deleteBannerInDb(
  db: Db,
  input: { readonly version: number; readonly id: string },
): Promise<DeleteBannerOutcome> {
  return db.transaction(async (tx): Promise<DeleteBannerOutcome> => {
    if (isStale(await lockVersion(tx), input.version)) return { kind: "stale" };
    const [deleted] = await tx
      .delete(banners)
      .where(eq(banners.id, input.id))
      .returning({ imageKey: banners.imageKey });
    if (!deleted) return { kind: "not_found" };
    return { kind: "deleted", version: await bumpVersion(tx), imageKey: deleted.imageKey };
  });
}

export type SaveHomepageOutcome =
  | { readonly kind: "stale" | "too_many_active" | "too_many_featured" | "invalid" }
  | { readonly kind: "product_unavailable"; readonly productIds: readonly string[] }
  | { readonly kind: "saved"; readonly version: number };

/**
 * The page save (AC-9): banner order and active flags, the featured list in order, and every
 * main's `show_on_home`, in one transaction. Nothing is written unless all of it can be.
 */
export async function saveHomepageInDb(db: Db, input: HomepageSave): Promise<SaveHomepageOutcome> {
  try {
    return await db.transaction(async (tx): Promise<SaveHomepageOutcome> => {
      const version = await lockVersion(tx);
      const [stored, picked] = await Promise.all([
        tx.select({ id: banners.id }).from(banners),
        input.featured.length
          ? tx
              .select({ id: products.id, status: products.status })
              .from(products)
              .where(inArray(products.id, [...input.featured]))
          : Promise.resolve([]),
      ]);
      const plan = planHomepageSave(
        {
          version,
          bannerIds: stored.map((row) => row.id),
          productStatus: new Map(picked.map((row) => [row.id, row.status])),
        },
        input,
      );
      if (plan.kind !== "save") return plan;

      for (const banner of plan.banners) {
        await tx
          .update(banners)
          .set({ sort: banner.sort, isActive: banner.isActive })
          .where(eq(banners.id, banner.id));
      }
      await tx.delete(featuredProducts);
      if (plan.featured.length) await tx.insert(featuredProducts).values([...plan.featured]);
      await tx
        .update(categories)
        .set({ showOnHome: inArray(categories.id, [...input.homeCategoryIds]) })
        .where(isNull(categories.parentId));
      return { kind: "saved", version: await bumpVersion(tx) };
    });
  } catch (error) {
    // A pick deleted between the check and the insert (AC-9): name the ones that are gone now.
    if (!isForeignKeyViolation(error)) throw error;
    const left = await db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, [...input.featured]));
    const kept = new Set(left.map((row) => row.id));
    return {
      kind: "product_unavailable",
      productIds: input.featured.filter((id) => !kept.has(id)),
    };
  }
}

export type PickerProduct = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly imageKey: string | null;
  readonly badge: FeaturedBadge | null;
};

const SEARCH_LIMIT = 10;

const firstImage = sql<
  string | null
>`(select m.storage_key from ${productMedia} m where m.product_id = ${products.id} and m.kind = 'image' order by m.sort, m.id limit 1)`;

/** The columns a picker row and a featured row need, over products joined to their categories. */
export const pickerColumns = {
  id: products.id,
  name: products.name,
  code: products.code,
  status: products.status,
  categoryShown: sql<boolean>`coalesce(${categoryShown}, false)`.mapWith(Boolean),
  inStock: sql<boolean>`${listedInStock}`.mapWith(Boolean),
  imageKey: firstImage,
};

export const toPickerProduct = (row: {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly status: "active" | "hidden" | "archived";
  readonly categoryShown: boolean;
  readonly inStock: boolean;
  readonly imageKey: string | null;
}): PickerProduct => ({
  id: row.id,
  name: row.name,
  code: row.code,
  imageKey: row.imageKey,
  badge: featuredBadge(row),
});

/**
 * The picker (AC-12): products not archived whose code starts with the upper cased query or whose
 * name contains it (spec 0006 AC-1), at most ten by name, leaving out the ones already picked.
 */
export async function searchHomeProductsInDb(
  db: Db,
  q: string,
  exclude: readonly string[],
): Promise<readonly PickerProduct[]> {
  const escaped = escapeLike(q);
  const rows = await db
    .select(pickerColumns)
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(
      and(
        ne(products.status, "archived"),
        or(
          sql`${products.code} like ${`${escaped.toUpperCase()}%`} escape '\\'`,
          sql`${products.name} ilike ${`%${escaped}%`} escape '\\'`,
        ),
        exclude.length ? notInArray(products.id, [...exclude]) : undefined,
      ),
    )
    .orderBy(asc(products.name), asc(products.id))
    .limit(SEARCH_LIMIT);
  return rows.map(toPickerProduct);
}
