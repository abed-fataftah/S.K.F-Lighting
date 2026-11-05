import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { HtmlDocument } from "@/components/html-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("DesignSystem");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

// A bare layout: the gallery shows the shell parts itself, in their static mode.
export default function GalleryLayout({ children }: LayoutProps<"/design-system">) {
  return (
    <HtmlDocument>
      <NextIntlClientProvider>{children}</NextIntlClientProvider>
    </HtmlDocument>
  );
}
