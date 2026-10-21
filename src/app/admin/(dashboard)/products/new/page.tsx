import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProductEditor } from "@/features/catalog/components/product-editor";
import { getEditorLookups } from "@/features/catalog/server/admin-queries";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminProducts");
  return { title: t("newMeta") };
}

// Add a product (spec 0006 AC-2). The server picks the product id now, so photos can upload into
// its folder before the first save; a repeated save of the same create is refused as stale.
export default async function NewProductPage() {
  const lookups = await getEditorLookups(routes.admin.productNew);
  const id = crypto.randomUUID();
  return <ProductEditor key={id} id={id} product={null} lookups={lookups} />;
}
