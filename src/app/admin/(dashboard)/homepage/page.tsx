import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HomepageEditor } from "@/features/home/components/homepage-editor";
import { HomepageError } from "@/features/home/components/homepage-error";
import { getHomepageEditor } from "@/features/home/server/editor-queries";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { withTimeLimit } from "@/server/db/time-limit";

const HOMEPAGE_READ_TIMEOUT_MS = 3000;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminHomepage");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// The homepage editor (spec 0011 AC-8; docs/design/pages/admin-homepage.md). The guard runs before
// the timed read, so its redirect is never mistaken for a failed read. A failed or slow read shows
// the error card with a retry button; logs say what failed, never values.
export default async function AdminHomepagePage() {
  await requireAdminPage(routes.admin.homepage);
  const result = await withTimeLimit(getHomepageEditor, HOMEPAGE_READ_TIMEOUT_MS);
  if (!result.ok) {
    console.error(
      JSON.stringify({
        event: "homepage_editor_read_failed",
        error:
          result.error === "timeout"
            ? "timeout"
            : result.cause instanceof Error
              ? result.cause.name
              : "unknown",
      }),
    );
    const t = await getTranslations("AdminHomepage");
    return (
      <>
        <h1 className="type-display-s">{t("title")}</h1>
        <HomepageError />
      </>
    );
  }
  return <HomepageEditor data={result.data} />;
}
