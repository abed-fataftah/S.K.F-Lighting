import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { toShekelsInput } from "@/lib/money";
import { pageWindow, splitPage } from "@/lib/paging";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import {
  categories,
  colours,
  orderLines,
  productMedia,
  products,
  productVariants,
} from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import {
  ADMIN_PRODUCTS_PAGE_SIZE,
  escapeLike,
  statusLabel,
  type ProductFilter,
  type ProductStatusLabel,
} from "../admin-list";
import type { AdminMain } from "../category-rules";
import type { MediaKind } from "../media-rules";
import { readAdminCategories } from "./categories";

// The dashboard's product reads (spec 0006, API surface). Each public query runs
// `requireAdminPage()` itself, so a page that forgets the layout guard still shows nothing.

type Db = Database | Transaction;

export type AdminProductRow = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly categoryPath: readonly string[];
  readonly mainImageKey: string | null;
  readonly minPrice: number | null;
  readonly maxPrice: number | null;
  readonly sizeCount: number;
  readonly colourCount: number;
  readonly status: ProductStatusLabel;
};

export type AdminProductFilters = {
  readonly q: string | null;
  readonly categoryId: string | null;
  readonly filter: ProductFilter;
  readonly page: number;
};

const parent = alias(categories, "parent");

// `min` and `max` over no live rows are null.
const numberOrNull = (value: unknown): number | null => (value === null ? null : Number(value));

// Correlated reads over the product's live variants (not archived).
const live = (expression: SQL) =>
  sql`(select ${expression} from ${productVariants} v where v.product_id = ${products.id} and v.archived_at is null)`;

/** A live variant can be sold, product rules aside (spec 0002 `isSellable`, in SQL). */
const hasAvailableVariant = sql`exists (select 1 from ${productVariants} v where v.product_id = ${products.id} and v.is_available and v.archived_at is null)`;
const sellable = and(
  eq(products.status, "active"),
  eq(products.isAvailable, true),
  hasAvailableVariant,
);

const filterWhere: Readonly<Record<ProductFilter, SQL | undefined>> = {
  all: ne(products.status, "archived"),
  available: sellable,
  unavailable: and(eq(products.status, "active"), sql`not (${sellable})`),
  hidden: eq(products.status, "hidden"),
  archived: eq(products.status, "archived"),
};

function searchWhere(q: string | null): SQL | undefined {
  if (!q) return undefined;
  const escaped = escapeLike(q);
  return or(
    sql`${products.code} like ${`${escaped.toUpperCase()}%`} escape '\\'`,
    sql`${products.name} ilike ${`%${escaped}%`} escape '\\'`,
  );
}

/** A main category includes its sub categories; an id that names no category filters nothing. */
function categoryWhere(categoryId: string | null): SQL | undefined {
  if (!categoryId) return undefined;
  return or(
    sql`not exists (select 1 from ${categories} where ${categories.id} = ${categoryId})`,
    eq(products.categoryId, categoryId),
    eq(categories.parentId, categoryId),
  );
}

export async function readAdminProducts(
  db: Db,
  filters: AdminProductFilters,
): Promise<{ readonly rows: readonly AdminProductRow[]; readonly hasNext: boolean }> {
  const { limit, offset } = pageWindow(filters.page, ADMIN_PRODUCTS_PAGE_SIZE);
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      code: products.code,
      status: products.status,
      categoryName: categories.name,
      parentName: parent.name,
      mainImageKey: sql<
        string | null
      >`(select m.storage_key from ${productMedia} m where m.product_id = ${products.id} and m.kind = 'image' order by m.sort, m.id limit 1)`,
      minPrice: live(sql`min(v.price)`).mapWith(numberOrNull),
      maxPrice: live(sql`max(v.price)`).mapWith(numberOrNull),
      sizeCount: live(sql`count(distinct v.size_label)`).mapWith(Number),
      colourCount: live(sql`count(distinct v.colour_id)`).mapWith(Number),
      sellable: sql<boolean>`${sellable}`.mapWith(Boolean),
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(parent, eq(parent.id, categories.parentId))
    .where(
      and(filterWhere[filters.filter], searchWhere(filters.q), categoryWhere(filters.categoryId)),
    )
    .orderBy(desc(products.createdAt), desc(products.id))
    .limit(limit)
    .offset(offset);

  const page = splitPage(rows, ADMIN_PRODUCTS_PAGE_SIZE);
  return {
    hasNext: page.hasNext,
    rows: page.rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      categoryPath: row.parentName ? [row.parentName, row.categoryName] : [row.categoryName],
      mainImageKey: row.mainImageKey,
      minPrice: row.minPrice,
      maxPrice: row.maxPrice,
      sizeCount: row.sizeCount,
      colourCount: row.colourCount,
      status: statusLabel(row.status, row.sellable),
    })),
  };
}

export async function listAdminProducts(filters: AdminProductFilters) {
  await requireAdminPage(routes.admin.productsList(filters));
  return readAdminProducts(await getDb(), filters);
}

export type CategoryChoice = {
  readonly id: string;
  readonly name: string;
  readonly isVisible: boolean;
  readonly children: readonly {
    readonly id: string;
    readonly name: string;
    readonly isVisible: boolean;
  }[];
};

export type EditorLookups = {
  readonly categories: readonly CategoryChoice[];
  readonly colours: readonly { readonly id: string; readonly name: string }[];
};

export async function readEditorLookups(db: Db): Promise<EditorLookups> {
  const [allCategories, allColours] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        parentId: categories.parentId,
        isVisible: categories.isVisible,
      })
      .from(categories)
      .orderBy(asc(categories.sort), asc(categories.name), asc(categories.id)),
    db
      .select({ id: colours.id, name: colours.name })
      .from(colours)
      .orderBy(asc(colours.sort), asc(colours.name)),
  ]);
  return {
    categories: allCategories
      .filter((category) => category.parentId === null)
      .map((main) => ({
        id: main.id,
        name: main.name,
        isVisible: main.isVisible,
        children: allCategories
          .filter((category) => category.parentId === main.id)
          .map(({ id, name, isVisible }) => ({ id, name, isVisible })),
      })),
    colours: allColours,
  };
}

export type ProductByCode = {
  readonly code: string;
  readonly id: string;
  readonly status: "active" | "hidden" | "archived";
  /** The product's main category: its category's parent when it sits in a sub, else its own. */
  readonly mainCategoryId: string;
};

/** The products behind these codes, any status (spec 0007 `readImportContext`); missing codes are left out. */
export async function readProductsByCodes(
  db: Db,
  codes: readonly string[],
): Promise<readonly ProductByCode[]> {
  if (!codes.length) return [];
  const rows = await db
    .select({
      code: products.code,
      id: products.id,
      status: products.status,
      categoryId: products.categoryId,
      parentId: categories.parentId,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(inArray(products.code, [...codes]));
  return rows.map((row) => ({
    code: row.code,
    id: row.id,
    status: row.status,
    mainCategoryId: row.parentId ?? row.categoryId,
  }));
}

/** Top level categories with their children, and every colour (spec 0006 `getEditorLookups`). */
export async function getEditorLookups(next: string): Promise<EditorLookups> {
  await requireAdminPage(next);
  return readEditorLookups(await getDb());
}

/** What the editor opens with: live rows only, prices as the owner would type them. */
export type ProductEditorState = {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly code: string;
  readonly slug: string;
  readonly mainCategoryId: string;
  readonly subCategoryId: string | null;
  readonly description: string;
  readonly specs: readonly { readonly label: string; readonly value: string }[];
  readonly visible: boolean;
  readonly available: boolean;
  readonly isArchived: boolean;
  /** An order points at it, so delete archives it instead (AC-12). */
  readonly hasOrders: boolean;
  /** The single price (simple or colours only); empty when there are sizes. */
  readonly price: string;
  readonly sizes: readonly {
    readonly originalLabel: string;
    readonly label: string;
    readonly price: string;
  }[];
  readonly colours: readonly { readonly colourId: string; readonly name: string }[];
  readonly pairs: readonly {
    readonly size: number | null;
    readonly colour: number | null;
    readonly available: boolean;
  }[];
  readonly media: readonly {
    readonly storageKey: string;
    readonly kind: MediaKind;
    readonly width: number | null;
    readonly height: number | null;
  }[];
};

export async function readProductEditor(db: Db, id: string): Promise<ProductEditorState | null> {
  const [product] = await db
    .select({
      id: products.id,
      version: products.version,
      name: products.name,
      code: products.code,
      slug: products.slug,
      description: products.description,
      specs: products.specs,
      status: products.status,
      isAvailable: products.isAvailable,
      categoryId: products.categoryId,
      parentId: categories.parentId,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, id))
    .limit(1);
  if (!product) return null;

  const [variants, media, ordered] = await Promise.all([
    db
      .select({
        sizeLabel: productVariants.sizeLabel,
        colourId: productVariants.colourId,
        colourName: colours.name,
        price: productVariants.price,
        isAvailable: productVariants.isAvailable,
      })
      .from(productVariants)
      .leftJoin(colours, eq(colours.id, productVariants.colourId))
      .where(and(eq(productVariants.productId, id), isNull(productVariants.archivedAt)))
      .orderBy(asc(productVariants.sizeSort), asc(productVariants.sort)),
    db
      .select({
        storageKey: productMedia.storageKey,
        kind: productMedia.kind,
        width: productMedia.width,
        height: productMedia.height,
      })
      .from(productMedia)
      .where(eq(productMedia.productId, id))
      .orderBy(asc(productMedia.sort), asc(productMedia.id)),
    db
      .select({ one: sql`1` })
      .from(orderLines)
      .where(eq(orderLines.productId, id))
      .limit(1),
  ]);

  const sizeLabels = [
    ...new Set(variants.flatMap((v) => (v.sizeLabel === null ? [] : [v.sizeLabel]))),
  ];
  const colourRows = variants
    .flatMap((v) =>
      v.colourId === null ? [] : [{ colourId: v.colourId, name: v.colourName ?? "" }],
    )
    .filter((row, index, all) => all.findIndex((r) => r.colourId === row.colourId) === index)
    // Colour order comes from `sort`; the rows above are ordered by size first.
    .sort(
      (a, b) =>
        variants.findIndex((v) => v.colourId === a.colourId) -
        variants.findIndex((v) => v.colourId === b.colourId),
    );

  const sizeIndexes = sizeLabels.length ? sizeLabels.map((_, i) => i) : [null];
  const colourIndexes = colourRows.length ? colourRows.map((_, i) => i) : [null];
  const pairs =
    sizeLabels.length || colourRows.length
      ? sizeIndexes.flatMap((size) =>
          colourIndexes.map((colour) => {
            const row = variants.find(
              (v) =>
                v.sizeLabel === (size === null ? null : sizeLabels[size]) &&
                v.colourId === (colour === null ? null : colourRows[colour].colourId),
            );
            return { size, colour, available: row?.isAvailable ?? true };
          }),
        )
      : [];

  return {
    id: product.id,
    version: product.version,
    name: product.name,
    code: product.code,
    slug: product.slug,
    mainCategoryId: product.parentId ?? product.categoryId,
    subCategoryId: product.parentId ? product.categoryId : null,
    description: product.description ?? "",
    specs: product.specs,
    visible: product.status === "active",
    available: product.isAvailable,
    isArchived: product.status === "archived",
    hasOrders: ordered.length > 0,
    price: sizeLabels.length === 0 && variants[0] ? toShekelsInput(variants[0].price) : "",
    sizes: sizeLabels.map((label) => ({
      originalLabel: label,
      label,
      price: toShekelsInput(variants.find((v) => v.sizeLabel === label)!.price),
    })),
    colours: colourRows,
    pairs,
    media,
  };
}

/** The product behind `/admin/products/[id]`, or null for the not found page. */
export async function getProductEditor(id: string): Promise<ProductEditorState | null> {
  await requireAdminPage(routes.admin.product(id));
  return readProductEditor(await getDb(), id);
}

/** The tree behind `/admin/categories` (spec 0008 AC-1). */
export async function listAdminCategories(): Promise<readonly AdminMain[]> {
  await requireAdminPage(routes.admin.categories);
  return readAdminCategories(await getDb());
}
