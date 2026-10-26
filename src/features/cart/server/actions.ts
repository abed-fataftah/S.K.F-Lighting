"use server";

import { getDb } from "@/server/db";
import { fail, ok, type Result } from "@/lib/result";
import { addLine, removeLine, setQuantity } from "../cart-cookie";
import { buildCartView } from "../cart-view";
import { addToCartSchema, removeFromCartSchema, setCartQuantitySchema } from "../schemas";
import { readCartRows } from "./cart-rows";
import { readCartCookie, writeCartCookie } from "./cookies";

// The cart actions (spec 0004 AC-4). Each rewrites the cookie whole, which also cleans a tampered
// one, and Next renders the page again with the new cookie, so totals and the count update.

type LineCount = { readonly lineCount: number };

export async function addToCart(
  variantId: string,
  quantity: number,
): Promise<Result<LineCount, "invalid" | "not_sellable" | "cart_full">> {
  const input = addToCartSchema.safeParse({ variantId, quantity });
  if (!input.success) return fail("invalid");

  const db = await getDb();
  const rows = await readCartRows(db, [input.data.variantId]);
  const [line] = buildCartView([{ variantId: input.data.variantId, quantity: 1 }], rows).lines;
  if (!line?.sellable) return fail("not_sellable");

  const added = addLine(await readCartCookie(), input.data.variantId, input.data.quantity);
  if (!added.ok) return fail(added.error);
  await writeCartCookie(added.lines);
  return ok({ lineCount: added.lines.length });
}

export async function setCartQuantity(
  variantId: string,
  quantity: number,
): Promise<Result<LineCount, "invalid">> {
  const input = setCartQuantitySchema.safeParse({ variantId, quantity });
  if (!input.success) return fail("invalid");
  const lines = setQuantity(await readCartCookie(), input.data.variantId, input.data.quantity);
  await writeCartCookie(lines);
  return ok({ lineCount: lines.length });
}

export async function removeFromCart(variantId: string): Promise<Result<LineCount, "invalid">> {
  const input = removeFromCartSchema.safeParse({ variantId });
  if (!input.success) return fail("invalid");
  const lines = removeLine(await readCartCookie(), input.data.variantId);
  await writeCartCookie(lines);
  return ok({ lineCount: lines.length });
}
