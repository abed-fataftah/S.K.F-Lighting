import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  readActiveZones,
  type DeliveryZoneOption,
} from "@/features/checkout/server/checkout-options";
import { firstProductImageKey } from "@/features/catalog/server/product-image-sql";
import { categoryShown, parentCategory } from "@/features/catalog/server/storefront-sql";
import { isSellable } from "@/features/catalog/sellable";
import {
  categories,
  colours,
  deliveryZones,
  draftLines,
  drafts,
  products,
  productVariants,
} from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { DraftLineView, DraftOption } from "../draft-view";

// The reads behind the quick order page (spec 0020 Feature design). Lines start from
// `draft_lines` and left join the catalog, so empty and product only lines come back too, and an
// archived product or option still shows its name with `sellable = false`. Prices are always live.

type Db = Database | Transaction;

/** Lines always order by `sort`, then `created_at`, then `id` (Key invariants). */
export const lineOrder = [asc(draftLines.sort), asc(draftLines.createdAt), asc(draftLines.id)];

type ProductRule = {
  readonly status: "active" | "hidden" | "archived";
  readonly isAvailable: boolean;
  readonly categoryShown: boolean;
};

type OptionRow = {
  readonly id: string;
  readonly productId: string;
  readonly code: string | null;
  readonly sizeLabel: string | null;
  readonly colourName: string | null;
  readonly price: number;
  readonly isAvailable: boolean;
  readonly archivedAt: Date | null;
};

const toOption = (product: ProductRule, row: OptionRow): DraftOption => ({
  id: row.id,
  code: row.code,
  sizeLabel: row.sizeLabel,
  colourName: row.colourName,
  price: row.price,
  sellable: isSellable(product, row),
  archived: row.archivedAt !== null,
});

/** The live, non archived options of these products in `sort` order. */
async function readOptions(db: Db, productIds: readonly string[]) {
  if (productIds.length === 0) return new Map<string, OptionRow[]>();
  const rows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      code: productVariants.code,
      sizeLabel: productVariants.sizeLabel,
      colourName: colours.name,
      price: productVariants.price,
      isAvailable: productVariants.isAvailable,
      archivedAt: productVariants.archivedAt,
    })
    .from(productVariants)
    .leftJoin(colours, eq(colours.id, productVariants.colourId))
    .where(
      and(inArray(productVariants.productId, [...productIds]), isNull(productVariants.archivedAt)),
    )
    .orderBy(asc(productVariants.sort), asc(productVariants.id));
  return rows.reduce((map, row) => {
    map.set(row.productId, [...(map.get(row.productId) ?? []), row]);
    return map;
  }, new Map<string, OptionRow[]>());
}

const chosenColour = sql<
  string | null
>`(select c.name from ${colours} c where c.id = ${productVariants.colourId})`;

/** The lines of a draft (all, or only `lineIds`) with live catalog rows, in line order. */
export async function readLineViews(
  db: Db,
  draftId: string,
  lineIds?: readonly string[],
): Promise<readonly DraftLineView[]> {
  if (lineIds && lineIds.length === 0) return [];
  const rows = await db
    .select({
      id: draftLines.id,
      sort: draftLines.sort,
      quantity: draftLines.quantity,
      productId: products.id,
      productName: products.name,
      productCode: products.code,
      productStatus: products.status,
      productAvailable: products.isAvailable,
      categoryShown: sql<boolean>`coalesce(${categoryShown}, false)`.mapWith(Boolean),
      imageKey: firstProductImageKey(products.id),
      variantId: productVariants.id,
      variantCode: productVariants.code,
      sizeLabel: productVariants.sizeLabel,
      colourName: chosenColour,
      price: productVariants.price,
      variantAvailable: productVariants.isAvailable,
      archivedAt: productVariants.archivedAt,
    })
    .from(draftLines)
    .leftJoin(products, eq(products.id, draftLines.productId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .leftJoin(productVariants, eq(productVariants.id, draftLines.variantId))
    .where(
      and(
        eq(draftLines.draftId, draftId),
        lineIds ? inArray(draftLines.id, [...lineIds]) : undefined,
      ),
    )
    .orderBy(...lineOrder);

  const options = await readOptions(db, [
    ...new Set(rows.flatMap((row) => (row.productId ? [row.productId] : []))),
  ]);

  return rows.map((row): DraftLineView => {
    if (!row.productId || !row.productName || !row.productCode || !row.productStatus) {
      return { id: row.id, sort: row.sort, quantity: row.quantity, product: null, option: null };
    }
    const rule: ProductRule = {
      status: row.productStatus,
      isAvailable: row.productAvailable ?? false,
      categoryShown: row.categoryShown,
    };
    const live = (options.get(row.productId) ?? []).map((option) => toOption(rule, option));
    const option =
      row.variantId && row.price !== null
        ? toOption(rule, {
            id: row.variantId,
            productId: row.productId,
            code: row.variantCode,
            sizeLabel: row.sizeLabel,
            colourName: row.colourName,
            price: row.price,
            isAvailable: row.variantAvailable ?? false,
            archivedAt: row.archivedAt,
          })
        : null;
    return {
      id: row.id,
      sort: row.sort,
      quantity: row.quantity,
      product: {
        id: row.productId,
        name: row.productName,
        code: row.productCode,
        imageKey: row.imageKey,
        sellable: live.some((o) => o.sellable),
        // An archived option the line still holds stays choosable as it is (AC-6).
        options: option?.archived ? [...live, option] : live,
      },
      option,
    };
  });
}

export type DraftCustomer = {
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly fulfilment: "pickup" | "delivery" | null;
  readonly deliveryZoneId: string | null;
  readonly city: string | null;
  readonly address: string | null;
  readonly notes: string | null;
};

export type DraftPage = {
  readonly id: string;
  readonly name: string;
  readonly customer: DraftCustomer;
  readonly lines: readonly DraftLineView[];
  /** Active zones by `sort`; a saved zone that is no longer active is added last (AC-10). */
  readonly zones: readonly (DeliveryZoneOption & { readonly active: boolean })[];
};

/** The draft, only when `userId` owns it (else null), with its lines and the zones. */
export async function readDraft(
  db: Db,
  userId: string,
  draftId: string,
): Promise<DraftPage | null> {
  const [draft] = await db
    .select({
      id: drafts.id,
      name: drafts.name,
      customerName: drafts.customerName,
      customerPhone: drafts.customerPhone,
      fulfilment: drafts.fulfilment,
      deliveryZoneId: drafts.deliveryZoneId,
      city: drafts.city,
      address: drafts.address,
      notes: drafts.notes,
      zoneName: deliveryZones.name,
      zoneFee: deliveryZones.fee,
      zoneActive: deliveryZones.isActive,
    })
    .from(drafts)
    .leftJoin(deliveryZones, eq(deliveryZones.id, drafts.deliveryZoneId))
    .where(and(eq(drafts.id, draftId), eq(drafts.ownerUserId, userId)))
    .limit(1);
  if (!draft) return null;

  const [lines, active] = await Promise.all([readLineViews(db, draftId), readActiveZones(db)]);
  const { id, name, zoneName, zoneFee, zoneActive, ...customer } = draft;
  const saved =
    customer.deliveryZoneId && zoneName !== null && zoneFee !== null && !zoneActive
      ? [{ id: customer.deliveryZoneId, name: zoneName, fee: zoneFee, active: false }]
      : [];
  return {
    id,
    name,
    customer,
    lines,
    zones: [...active.map((zone) => ({ ...zone, active: true })), ...saved],
  };
}

export type DraftSummary = {
  readonly id: string;
  readonly name: string;
  readonly lineCount: number;
  readonly updatedAt: Date;
};

/** The drafts list (AC-3): newest edit first, then `id` descending. At most 30, so no paging. */
export function readMyDrafts(db: Db, userId: string): Promise<readonly DraftSummary[]> {
  return db
    .select({
      id: drafts.id,
      name: drafts.name,
      // Table qualified: a select over one table renders `drafts.id` bare, which would name `l.id`.
      lineCount:
        sql<number>`(select count(*) from ${draftLines} l where l.draft_id = "drafts"."id")`.mapWith(
          Number,
        ),
      updatedAt: drafts.updatedAt,
    })
    .from(drafts)
    .where(eq(drafts.ownerUserId, userId))
    .orderBy(desc(drafts.updatedAt), desc(drafts.id));
}
