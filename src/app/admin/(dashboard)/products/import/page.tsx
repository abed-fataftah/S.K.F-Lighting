import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ImportProducts } from "@/features/catalog/components/import/import-products";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminImport");
  return { title: t("metaTitle") };
}

// Spreadsheet import and bulk photos (spec 0007). Everything happens in the page: the file is read
// in the browser and each step calls its own admin action, which checks the admin again.
export default async function ProductImportPage() {
  await requireAdminPage(routes.admin.productImport);
  return <ImportProducts />;
}
