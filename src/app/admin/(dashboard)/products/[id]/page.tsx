import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { ProductEditor } from "@/features/catalog/components/product-editor";
import { getEditorLookups, getProductEditor } from "@/features/catalog/server/admin-queries";
import { routes } from "@/lib/routes";
import { isUuid } from "@/lib/uuid";

const loadProduct = cache(async (id: string) =>
  isUuid(id) ? getProductEditor(id.toLowerCase()) : null,
);

export async function generateMetadata({
  params,
}: PageProps<"/admin/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [t, product] = await Promise.all([getTranslations("AdminProducts"), loadProduct(id)]);
  return { title: product ? t("editMeta", { name: product.name }) : t("metaTitle") };
}

// Edit a product (spec 0006). Keyed by version: after a refresh with a newer stored product
// (a stale reload, an archive, a restore) the editor starts again from what is stored.
export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const [product, lookups] = await Promise.all([
    loadProduct(id),
    getEditorLookups(routes.admin.product(id)),
  ]);
  if (!product) notFound();
  return (
    <ProductEditor
      key={`${product.id}:${product.version}`}
      id={product.id}
      product={product}
      lookups={lookups}
    />
  );
}
