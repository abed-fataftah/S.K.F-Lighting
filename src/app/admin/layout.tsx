import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { HtmlDocument } from "@/components/html-document";
import { SkipLink } from "@/components/skip-link";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminShell");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// The dashboard's root layout: Arabic, right to left, never indexed. The sign in pages render
// straight inside it; the guarded pages add the sidebar in `(dashboard)/layout.tsx`.
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <HtmlDocument>
      <NextIntlClientProvider>
        <SkipLink />
        {children}
      </NextIntlClientProvider>
    </HtmlDocument>
  );
}
