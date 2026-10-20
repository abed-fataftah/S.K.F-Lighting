import "server-only";
import { asc, eq } from "drizzle-orm";
import { deliveryZones, shopSettings } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";

export type DeliveryZoneOption = {
  readonly id: string;
  readonly name: string;
  readonly fee: number;
};

/** Active zones by `sort` (spec 0004, Value sourcing: zone list and fees). */
export function readActiveZones(
  db: Database | Transaction,
): Promise<readonly DeliveryZoneOption[]> {
  return db
    .select({ id: deliveryZones.id, name: deliveryZones.name, fee: deliveryZones.fee })
    .from(deliveryZones)
    .where(eq(deliveryZones.isActive, true))
    .orderBy(asc(deliveryZones.sort), asc(deliveryZones.name));
}

/** The shop address for the pickup line, or null to show only the no fee words. */
export async function readPickupAddress(db: Database | Transaction): Promise<string | null> {
  const [row] = await db.select({ address: shopSettings.address }).from(shopSettings).limit(1);
  return row?.address?.trim() || null;
}
