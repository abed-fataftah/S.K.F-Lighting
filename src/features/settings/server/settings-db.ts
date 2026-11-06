import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { deliveryZones, pages, shopSettings } from "@/server/db/schema";
import { isUniqueViolation } from "@/server/db/pg-error";
import type { Database, Transaction } from "@/server/db/types";
import type { PolicySlug } from "@/features/policies/slugs";
import {
  ZONE_LIMIT,
  type SaveZoneData,
  type SavePolicyData,
  type ShopContactData,
  type ZoneData,
} from "../schemas";

// The settings writes and the hub's read (spec 0025, API surface). Contact and zone saves are last
// write wins; a policy save is refused unless it carries the version it loaded (AC-11).

type Db = Database | Transaction;

export type SettingsContact = {
  readonly whatsappNumber: string | null;
  readonly contactPhone: string | null;
  readonly address: string | null;
};

export type SettingsZone = {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  /** Agorot. */
  readonly fee: number;
  readonly isActive: boolean;
};

export type SettingsPolicy = {
  readonly slug: PolicySlug;
  readonly title: string;
  readonly updatedAt: Date;
};

export type SettingsPageData = {
  readonly contact: SettingsContact;
  readonly zones: readonly SettingsZone[];
  readonly policies: readonly SettingsPolicy[];
};

const contactColumns = {
  whatsappNumber: shopSettings.whatsappNumber,
  contactPhone: shopSettings.contactPhone,
  address: shopSettings.address,
};

const zoneColumns = {
  id: deliveryZones.id,
  name: deliveryZones.name,
  shortName: deliveryZones.shortName,
  fee: deliveryZones.fee,
  isActive: deliveryZones.isActive,
};

const ZONE_NAME_UNIQUE = "delivery_zones_name_unique";

/** Every zone, active and paused, by `sort` then name (AC-5). */
export function readZones(db: Db): Promise<SettingsZone[]> {
  return db
    .select(zoneColumns)
    .from(deliveryZones)
    .orderBy(asc(deliveryZones.sort), asc(deliveryZones.name));
}

export async function readSettingsPage(db: Db): Promise<SettingsPageData> {
  const [[contact], zones, policies] = await Promise.all([
    db.select(contactColumns).from(shopSettings).where(eq(shopSettings.id, 1)),
    readZones(db),
    db.select({ slug: pages.slug, title: pages.title, updatedAt: pages.updatedAt }).from(pages),
  ]);
  return {
    contact: contact ?? { whatsappNumber: null, contactPhone: null, address: null },
    zones,
    policies: policies as SettingsPolicy[],
  };
}

/** `home_version` is left alone: the homepage editor owns it (spec 0011). */
export async function saveShopContactInDb(db: Db, data: ShopContactData): Promise<SettingsContact> {
  const [row] = await db
    .update(shopSettings)
    .set(data)
    .where(eq(shopSettings.id, 1))
    .returning(contactColumns);
  return row;
}

export type ZoneOutcome =
  | { readonly kind: "saved"; readonly zone: SettingsZone }
  | { readonly kind: "not_found" | "name_taken" | "zone_limit" };

const nameTaken = (error: unknown): ZoneOutcome | null =>
  isUniqueViolation(error, ZONE_NAME_UNIQUE) ? { kind: "name_taken" } : null;

/** Its own transaction (a savepoint inside another), so a refused name leaves the caller's intact. */
export async function saveZoneInDb(db: Db, data: SaveZoneData): Promise<ZoneOutcome> {
  const { id, ...zone } = data;
  try {
    return await db.transaction(async (tx): Promise<ZoneOutcome> => {
      const [row] = await tx
        .update(deliveryZones)
        .set(zone)
        .where(eq(deliveryZones.id, id))
        .returning(zoneColumns);
      return row ? { kind: "saved", zone: row } : { kind: "not_found" };
    });
  } catch (error) {
    const outcome = nameTaken(error);
    if (outcome) return outcome;
    throw error;
  }
}

/**
 * A new active zone at the end of the list (AC-6). The table lock lets one add count at a time, so
 * two adds at 9 zones cannot both pass the limit; checkout's reads are not blocked by it.
 */
export async function addZoneInDb(db: Db, data: ZoneData): Promise<ZoneOutcome> {
  try {
    return await db.transaction(async (tx): Promise<ZoneOutcome> => {
      await tx.execute(sql`lock table ${deliveryZones} in share row exclusive mode`);
      const [{ zones, lastSort }] = await tx
        .select({ zones: count(), lastSort: sql<number>`coalesce(max(${deliveryZones.sort}), 0)` })
        .from(deliveryZones);
      if (zones >= ZONE_LIMIT) return { kind: "zone_limit" };
      const [row] = await tx
        .insert(deliveryZones)
        .values({ ...data, sort: Number(lastSort) + 1, isActive: true })
        .returning(zoneColumns);
      return { kind: "saved", zone: row };
    });
  } catch (error) {
    const outcome = nameTaken(error);
    if (outcome) return outcome;
    throw error;
  }
}

export async function setZoneActiveInDb(
  db: Db,
  id: string,
  isActive: boolean,
): Promise<ZoneOutcome> {
  const [row] = await db
    .update(deliveryZones)
    .set({ isActive })
    .where(eq(deliveryZones.id, id))
    .returning(zoneColumns);
  return row ? { kind: "saved", zone: row } : { kind: "not_found" };
}

export type PolicyOutcome =
  | { readonly kind: "saved"; readonly version: number; readonly updatedAt: Date }
  | { readonly kind: "not_found" | "stale" };

/** Writes only when the stored `version` is the one the editor loaded, and bumps it (AC-11). */
export async function savePolicyInDb(db: Db, data: SavePolicyData): Promise<PolicyOutcome> {
  const [row] = await db
    .update(pages)
    .set({ title: data.title, body: data.body, version: sql`${pages.version} + 1` })
    .where(and(eq(pages.slug, data.slug), eq(pages.version, data.version)))
    .returning({ version: pages.version, updatedAt: pages.updatedAt });
  if (row) return { kind: "saved", ...row };
  const [exists] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, data.slug));
  return exists ? { kind: "stale" } : { kind: "not_found" };
}
