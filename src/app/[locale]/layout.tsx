import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { HtmlDocument } from "@/components/html-document";
import { routing } from "@/i18n/routing";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("title"), description: t("description") };
}

export default async function StorefrontLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <HtmlDocument>
      <NextIntlClientProvider>{children}</NextIntlClientProvider>
    </HtmlDocument>
  );
}
