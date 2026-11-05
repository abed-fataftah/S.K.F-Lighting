import "server-only";
import { cache } from "react";
import { getDb } from "@/server/db";
import { buildCartView, emptyCartView, type CartView } from "../cart-view";
import { readCartRows } from "./cart-rows";
import { readCartCookie } from "./cookies";

/** The cart with live prices and names (spec 0004 AC-4, AC-5). */
export const readCart = cache(async (): Promise<CartView> => {
  const lines = await readCartCookie();
  if (lines.length === 0) return emptyCartView;
  const db = await getDb();
  const rows = await readCartRows(
    db,
    lines.map((line) => line.variantId),
  );
  return buildCartView(lines, rows);
});

/** The header and bottom bar count: the number of lines in the cookie, no database read. */
export async function readCartCount(): Promise<number> {
  return (await readCartCookie()).length;
}
