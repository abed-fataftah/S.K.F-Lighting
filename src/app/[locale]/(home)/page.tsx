import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { serializeJsonLd } from "@/features/catalog/seo";
import { shareMetadata, shopImage } from "@/features/seo/share";
import { storeFromContact } from "@/features/seo/store-jsonld";
import {
  getShopAddress,
  getShopContact,
  getWhatsappNumber,
  pickWhatsappNumber,
} from "@/features/shell/server/shop-contact";
import { BannerCarousel } from "@/features/home/components/banner-carousel";
import { HeroCard } from "@/features/home/components/hero-card";
import {
  CategoriesSection,
  FeaturedSection,
  TrustSection,
} from "@/features/home/components/home-sections";
import { buildZoneLine } from "@/features/home/fees";
import { shopNowTarget } from "@/features/home/home-rules";
import { canAddToDraft } from "@/features/drafts/server/guard";
import { getDeliveryFees, getHomeSections } from "@/features/home/server/home";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";

// Home's own title names the town; its share tags use the shop image (spec 0026 AC-8).
export async function generateMetadata(): Promise<Metadata> {
  const [meta, seo] = await Promise.all([getTranslations("Metadata"), getTranslations("Seo")]);
  const { siteUrl } = parsePublicEnv();
  const canonical = `${siteUrl}${routes.home}`;
  return {
    title: seo("homeTitle"),
    description: seo("homeDescription"),
    alternates: { canonical },
    ...shareMetadata({
      siteName: meta("title"),
      title: seo("homeTitle"),
      description: seo("homeDescription"),
      canonical,
      image: shopImage(siteUrl, seo("shopImageAlt")),
    }),
  };
}

// Home (spec 0011 AC-1): the banners or the hero, the category circles, the featured products,
// and the trust cards, inside the shop layout's strip, header, and footer. Every part is read
// together and stands alone: a part whose read failed is null and only that part is gone (AC-7).
// The page has one `h1`: the hero's headline, else a hidden one with the shop's name.
export default async function HomePage() {
  const [t, meta, seo, sections, fees, address, contact, draftButtons] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Metadata"),
    getTranslations("Seo"),
    getHomeSections(),
    getDeliveryFees(),
    getShopAddress(),
    getShopContact(),
    canAddToDraft(),
  ]);
  const { siteUrl } = parsePublicEnv();
  const whatsappNumber = await getWhatsappNumber();
  const banners = sections.banners ?? [];
  const circles = sections.circles ?? [];
  const featured = sections.featured ?? [];
  // The `Store` block for local search (spec 0026 AC-9), from the same cached contact read.
  const store = storeFromContact(contact, {
    siteUrl,
    fallbackName: meta("title"),
    whatsappNumber: pickWhatsappNumber(contact.whatsappNumber),
    town: seo("town"),
  });

  return (
    <div className="flex flex-col pt-3.5 pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(store) }}
      />
      {banners.length ? (
        <>
          <h1 className="sr-only">{t("title")}</h1>
          <BannerCarousel banners={banners} />
        </>
      ) : (
        <HeroCard
          whatsappNumber={whatsappNumber}
          jumpTo={shopNowTarget(circles.length, featured.length)}
        />
      )}
      {circles.length ? <CategoriesSection circles={circles} /> : null}
      {featured.length ? (
        <FeaturedSection
          products={featured}
          whatsappNumber={whatsappNumber}
          siteUrl={siteUrl}
          canAddToDraft={draftButtons}
        />
      ) : null}
      <TrustSection zoneLine={buildZoneLine(fees)} address={address} />
    </div>
  );
}
