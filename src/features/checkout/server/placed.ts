import "server-only";
import { cookies } from "next/headers";
import { CART_COOKIE } from "@/features/cart/cart-cookie";
import { shopCookieOptions } from "@/features/cart/server/cookies";
import {
  addPlaced,
  parsePlaced,
  PLACED_COOKIE,
  PLACED_COOKIE_MAX_AGE,
  serializePlaced,
} from "../placed-cookie";

export async function readPlacedIds(): Promise<readonly string[]> {
  return parsePlaced((await cookies()).get(PLACED_COOKIE)?.value);
}

/** After an order is saved or replayed: this browser may open its confirmation, and the cart empties. */
export async function rememberPlacedOrder(orderId: string): Promise<void> {
  const store = await cookies();
  const ids = addPlaced(parsePlaced(store.get(PLACED_COOKIE)?.value), orderId);
  store.set(PLACED_COOKIE, serializePlaced(ids), shopCookieOptions(PLACED_COOKIE_MAX_AGE));
  store.delete(CART_COOKIE);
}
