import "server-only";
import { cookies } from "next/headers";
import {
  CART_COOKIE,
  CART_COOKIE_MAX_AGE,
  parseCart,
  serializeCart,
  type CartLine,
} from "../cart-cookie";

// Both shop cookies are httpOnly and SameSite=Lax; Secure in production (spec 0004, cookies table).
export const shopCookieOptions = (maxAge: number) =>
  ({
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  }) as const;

/** The parsed cart. Reading never writes: the next cart action rewrites the cleaned cookie whole. */
export async function readCartCookie(): Promise<readonly CartLine[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value);
}

/** Server Actions only. */
export async function writeCartCookie(lines: readonly CartLine[]): Promise<void> {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, serializeCart(lines), shopCookieOptions(CART_COOKIE_MAX_AGE));
}
