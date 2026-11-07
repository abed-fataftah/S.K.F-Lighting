import type { Metadata } from "next";
import { reportError } from "@/server/monitoring/report";
import { failureOf } from "@/server/monitoring/throttle";
import { getTranslations } from "next-intl/server";
import { CategoriesError } from "@/features/catalog/components/categories/categories-error";
import { CategoriesManager } from "@/features/catalog/components/categories/categories-manager";
import { listAdminCategories } from "@/features/catalog/server/admin-queries";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { withTimeLimit } from "@/server/db/time-limit";

const CATEGORIES_READ_TIMEOUT_MS = 3000;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminCategories");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// The categories page (spec 0008 AC-1; docs/design/pages/admin-categories.md). The guard runs
// before the timed read, so its redirect is never mistaken for a failed read. A failed or slow
// read shows the error card with a retry button; logs say what failed, never values.
export default async function AdminCategoriesPage() {
  await requireAdminPage(routes.admin.categories);
  const result = await withTimeLimit(listAdminCategories, CATEGORIES_READ_TIMEOUT_MS);
  if (!result.ok) {
    await reportError("admin_categories_read_failed", failureOf(result));
    const t = await getTranslations("AdminCategories");
    return (
      <>
        <h1 className="type-display-s">{t("title")}</h1>
        <CategoriesError />
      </>
    );
  }
  return <CategoriesManager mains={result.data} />;
}
