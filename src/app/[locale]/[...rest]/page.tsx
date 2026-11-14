import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

// An address no storefront route matches (`/no-such-page`, `/account/nothing`). Calling notFound()
// here, under the locale layout, shows the designed 404 card inside the shell ([locale]/not-found.tsx,
// spec 0029 AC-17) instead of the bare root page.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("notFound") };
}

export default function UnknownStorefrontPage() {
  notFound();
}
