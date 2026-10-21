import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { productMedia, products } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";

// The database half of `setProductPhotos` (spec 0007 AC-13): the imported photos become the
// product's whole photo set in the order given, and its video sorts after them. No version check:
// the import's photos win over an editor tab open on the same product, which then meets `stale`.

export type PhotoImage = {
  readonly storageKey: string;
  readonly width: number;
  readonly height: number;
};

export type SetPhotosOutcome =
  | { readonly kind: "saved"; readonly version: number; readonly keptKeys: readonly string[] }
  | { readonly kind: "not_found" }
  | { readonly kind: "archived" };

export async function setProductPhotosInDb(
  db: Database | Transaction,
  productId: string,
  images: readonly PhotoImage[],
): Promise<SetPhotosOutcome> {
  return db.transaction(async (tx) => {
    const [product] = await tx
      .select({ status: products.status })
      .from(products)
      .where(eq(products.id, productId))
      .for("update");
    if (!product) return { kind: "not_found" };
    if (product.status === "archived") return { kind: "archived" };

    await tx
      .delete(productMedia)
      .where(and(eq(productMedia.productId, productId), eq(productMedia.kind, "image")));
    await tx.insert(productMedia).values(
      images.map((image, sort) => ({
        productId,
        kind: "image" as const,
        storageKey: image.storageKey,
        width: image.width,
        height: image.height,
        sort,
      })),
    );
    const videos = await tx
      .update(productMedia)
      .set({ sort: images.length, updatedAt: sql`now()` })
      .where(and(eq(productMedia.productId, productId), eq(productMedia.kind, "video")))
      .returning({ storageKey: productMedia.storageKey });
    const [bumped] = await tx
      .update(products)
      .set({ version: sql`${products.version} + 1` })
      .where(eq(products.id, productId))
      .returning({ version: products.version });

    return {
      kind: "saved",
      version: bumped.version,
      keptKeys: [...images.map((image) => image.storageKey), ...videos.map((v) => v.storageKey)],
    };
  });
}
