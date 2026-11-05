import "server-only";
import { cookies } from "next/headers";
import { shopCookieOptions } from "@/features/cart/server/cookies";
import { serializeOrderIds } from "../order-ids-cookie";
import {
  addTracked,
  parseTracked,
  TRACKED_COOKIE,
  TRACKED_COOKIE_MAX_AGE,
} from "../tracked-cookie";

export async function readTrackedIds(): Promise<readonly string[]> {
  return parseTracked((await cookies()).get(TRACKED_COOKIE)?.value);
}

/** After a lookup matched (spec 0015 AC-4): this browser may open that order's page. */
export async function rememberTrackedOrder(orderId: string): Promise<void> {
  const store = await cookies();
  const ids = addTracked(parseTracked(store.get(TRACKED_COOKIE)?.value), orderId);
  store.set(TRACKED_COOKIE, serializeOrderIds(ids), shopCookieOptions(TRACKED_COOKIE_MAX_AGE));
}
