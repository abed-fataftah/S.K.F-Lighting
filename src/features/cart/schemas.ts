// Inputs of the cart actions (spec 0004 AC-4). Quantities arrive as numbers from the stepper.
import { z } from "zod";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/quantity";

const quantity = z.number().int().min(MIN_QUANTITY).max(MAX_QUANTITY);

export const addToCartSchema = z.object({ variantId: z.guid(), quantity });
export const setCartQuantitySchema = z.object({ variantId: z.guid(), quantity });
export const removeFromCartSchema = z.object({ variantId: z.guid() });
