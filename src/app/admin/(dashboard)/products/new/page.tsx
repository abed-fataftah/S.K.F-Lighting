import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductForm } from "@/features/catalog/components/product-form";
import { listCategoriesForForm } from "@/features/catalog/server/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminProducts");
  return { title: t("newMeta") };
}

// Add a product (spec 0004 AC-2). The products list (`/admin/products`) comes with feature 7.
export default async function NewProductPage() {
  const [t, categories] = await Promise.all([
    getTranslations("AdminProducts"),
    listCategoriesForForm(),
  ]);

  return (
    <>
      <h1 className="type-display-s">{t("newTitle")}</h1>
      <ProductForm categories={categories} />
    </>
  );
}
