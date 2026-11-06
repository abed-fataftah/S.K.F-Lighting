import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { HtmlDocument } from "@/components/html-document";
import { SkipLink } from "@/components/skip-link";
import { readCartCount } from "@/features/cart/server/queries";
import { defaultShareMetadata, shopImage } from "@/features/seo/share";
import { listNavigation } from "@/features/catalog/server/queries";
import { buildStripText } from "@/features/home/fees";
import { getDeliveryFees } from "@/features/home/server/home";
import { BottomBar } from "@/features/shell/components/bottom-bar";
import { InfoStrip } from "@/features/shell/components/info-strip";
import { SiteFooter } from "@/features/shell/components/site-footer";
import { SiteHeader } from "@/features/shell/components/site-header";
import { WhatsAppFab } from "@/features/shell/components/whatsapp-fab";
import { AnalyticsBeacon } from "@/features/stats/components/analytics-beacon";
import { getShopContact, pickWhatsappNumber } from "@/features/shell/server/shop-contact";
import { routing } from "@/i18n/routing";
import { parsePublicEnv } from "@/lib/public-env";

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const [t, seo] = await Promise.all([
    getTranslations({ locale, namespace: "Metadata" }),
    getTranslations({ locale, namespace: "Seo" }),
  ]);
  const { siteUrl } = parsePublicEnv();
  // Every storefront page shares with the shop image unless it sets its own (spec 0026 AC-5).
  return {
    metadataBase: new URL(siteUrl),
    title: t("title"),
    description: t("description"),
    ...defaultShareMetadata({
      siteName: t("title"),
      image: shopImage(siteUrl, seo("shopImageAlt")),
    }),
  };
}

// The storefront shell (spec 0003, AC-11): one centered 480px column on the page colour.
// The bottom bar and the WhatsApp float are fixed, so the column keeps room under its last
// line (bar height plus the safe area), and the page scrolls a focused field clear of the bar.
export default async function StorefrontLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // The menu's categories never break the shell: a failed or slow read gives null (spec 0008 AC-14).
  // The fees are one small cached read the home page reuses for its delivery card (spec 0011 AC-6).
  const [contact, cartCount, navigation, fees, home] = await Promise.all([
    getShopContact(),
    readCartCount(),
    listNavigation(),
    getDeliveryFees(),
    getTranslations({ locale, namespace: "Home" }),
  ]);
  // The saved number, else the env one; a failed or slow contact read falls back too (spec 0025 AC-4).
  const whatsappNumber = pickWhatsappNumber(contact.whatsappNumber);
  const strip = buildStripText(fees, (zones) => home("strip", { zones }));

  return (
    <HtmlDocument className="scroll-pb-[calc(var(--h-bottom-bar)+env(safe-area-inset-bottom))]">
      <NextIntlClientProvider>
        <div className="mx-auto flex min-h-dvh w-full max-w-(--page-max) flex-col pb-[calc(var(--h-bottom-bar)+env(safe-area-inset-bottom))]">
          <SkipLink />
          <InfoStrip text={strip} />
          <SiteHeader
            whatsappNumber={whatsappNumber}
            cartCount={cartCount}
            categories={navigation ?? []}
          />
          <main id="main" tabIndex={-1} className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter contact={contact} />
        </div>
        <BottomBar cartCount={cartCount} />
        <WhatsAppFab whatsappNumber={whatsappNumber} />
      </NextIntlClientProvider>
      {/* Storefront only, never under /admin or /auth (spec 0027 AC-6). */}
      <AnalyticsBeacon />
    </HtmlDocument>
  );
}
