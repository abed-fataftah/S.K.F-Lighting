import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { HtmlDocument } from "@/components/html-document";
import { SkipLink } from "@/components/skip-link";
import { readCartCount } from "@/features/cart/server/queries";
import { BottomBar } from "@/features/shell/components/bottom-bar";
import { InfoStrip } from "@/features/shell/components/info-strip";
import { SiteFooter } from "@/features/shell/components/site-footer";
import { SiteHeader } from "@/features/shell/components/site-header";
import { WhatsAppFab } from "@/features/shell/components/whatsapp-fab";
import { getShopContact } from "@/features/shell/server/shop-contact";
import { routing } from "@/i18n/routing";
import { parsePublicEnv } from "@/lib/public-env";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("title"), description: t("description") };
}

// The storefront shell (spec 0003, AC-11): one centered 480px column on the page colour.
// The bottom bar and the WhatsApp float are fixed, so the column keeps room under its last
// line (bar height plus the safe area), and the page scrolls a focused field clear of the bar.
export default async function StorefrontLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const { whatsappNumber } = parsePublicEnv();
  const [contact, cartCount] = await Promise.all([getShopContact(), readCartCount()]);

  return (
    <HtmlDocument className="scroll-pb-[calc(var(--h-bottom-bar)+env(safe-area-inset-bottom))]">
      <NextIntlClientProvider>
        <div className="mx-auto flex min-h-dvh w-full max-w-(--page-max) flex-col pb-[calc(var(--h-bottom-bar)+env(safe-area-inset-bottom))]">
          <SkipLink />
          <InfoStrip />
          <SiteHeader whatsappNumber={whatsappNumber} cartCount={cartCount} />
          <main id="main" tabIndex={-1} className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter contact={contact} />
        </div>
        <BottomBar cartCount={cartCount} />
        <WhatsAppFab whatsappNumber={whatsappNumber} />
      </NextIntlClientProvider>
    </HtmlDocument>
  );
}
