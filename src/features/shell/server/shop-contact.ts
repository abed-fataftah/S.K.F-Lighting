import "server-only";
import { cache } from "react";
import { getDb } from "@/server/db";
import { shopSettings } from "@/server/db/schema";
import { withTimeLimit } from "@/server/db/time-limit";
import { contactLine, noContact, type ShopContact } from "../contact";

// The footer's contact details (spec 0003, AC-15). Public shop data, never customer data.
// A failed or slow read (over 1.5 seconds) gives nulls, so the footer hides the line and
// the page still renders. Logs say what went wrong, never the values.
export const CONTACT_TIMEOUT_MS = 1500;

export async function readShopContact(
  read: () => Promise<ShopContact>,
  timeoutMs: number = CONTACT_TIMEOUT_MS,
): Promise<ShopContact> {
  const result = await withTimeLimit(read, timeoutMs);
  if (result.ok) return result.data;
  if (result.error === "timeout") {
    console.error("getShopContact: no answer within the time limit", { timeoutMs });
  } else {
    console.error("getShopContact: read failed", {
      error: result.cause instanceof Error ? result.cause.name : "unknown",
    });
  }
  return noContact;
}

export const getShopContact = cache(() =>
  readShopContact(async () => {
    const db = await getDb();
    const [row] = await db
      .select({ phone: shopSettings.contactPhone, address: shopSettings.address })
      .from(shopSettings)
      .limit(1);
    return row ?? noContact;
  }),
);

/**
 * The address for Home's pickup card (spec 0011 AC-6): the same cached read as the footer, so a
 * failed or slow read gives null and the card shows its fallback line.
 */
export async function getShopAddress(): Promise<string | null> {
  return contactLine(await getShopContact())?.address ?? null;
}
