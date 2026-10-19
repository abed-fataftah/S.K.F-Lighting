import "server-only";
import { cache } from "react";
import { getDb } from "@/server/db";
import { shopSettings } from "@/server/db/schema";
import { noContact, type ShopContact } from "../contact";

// The footer's contact details (spec 0003, AC-15). Public shop data, never customer data.
// A failed or slow read (over 1.5 seconds) gives nulls, so the footer hides the line and
// the page still renders. Logs say what went wrong, never the values.
export const CONTACT_TIMEOUT_MS = 1500;

export async function readShopContact(
  read: () => Promise<ShopContact>,
  timeoutMs: number = CONTACT_TIMEOUT_MS,
): Promise<ShopContact> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    const result = await Promise.race([read(), timeout]);
    if (result === "timeout") {
      console.error("getShopContact: no answer within the time limit", { timeoutMs });
      return noContact;
    }
    return result;
  } catch (error) {
    console.error("getShopContact: read failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return noContact;
  } finally {
    clearTimeout(timer);
  }
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
