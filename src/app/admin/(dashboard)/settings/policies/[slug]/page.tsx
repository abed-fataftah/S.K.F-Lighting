import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPolicyPage } from "@/features/policies/server/queries";
import { isPolicySlug } from "@/features/policies/slugs";
import { PolicyEditor } from "@/features/settings/components/policy-editor";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";

async function loadPage(slug: string) {
  if (!isPolicySlug(slug)) notFound();
  await requireAdminPage(routes.admin.policy(slug));
  return (await getPolicyPage(slug)) ?? notFound();
}

export async function generateMetadata({
  params,
}: PageProps<"/admin/settings/policies/[slug]">): Promise<Metadata> {
  const [{ slug }, t] = await Promise.all([params, getTranslations("AdminSettings")]);
  const page = await loadPage(slug);
  return {
    title: t("editorMetaTitle", { title: page.title }),
    robots: { index: false, follow: false },
  };
}

// One policy's editor (spec 0025 AC-10, AC-11), owner only. The guard runs before the read; any
// other slug is a 404. The editor keeps the version it loaded for the stale check.
export default async function PolicyEditorPage({
  params,
}: PageProps<"/admin/settings/policies/[slug]">) {
  const { slug } = await params;
  const page = await loadPage(slug);
  return (
    <PolicyEditor slug={page.slug} title={page.title} body={page.body} version={page.version} />
  );
}
