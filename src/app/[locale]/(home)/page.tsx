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
import { HeroCoverflow } from "@/features/home/components/hero-coverflow";
import { CategoriesSection, TrustSection } from "@/features/home/components/home-sections";
import { canAddToDraft } from "@/features/drafts/server/guard";
import { heroChoice, shopNowTarget } from "@/features/home/home-rules";
import { getDeliveryFees, getHomeSections } from "@/features/home/server/home";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { PageFrame } from "@/components/page-frame";

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

// Home (spec 0030 AC-1): the hero (the product coverflow, or the fallback card with no products),
// the banners under it when any is on, the category cards with the selected category's products
// (spec 0031), and the trust cards, inside the shop
// layout's strip, header, and footer. Every part is read together and stands alone: a part whose
// read failed is null and only that part is gone (spec 0011 AC-7). The hero owns the page's one
// `h1`. The coverflow renders outside the page frame so its black band reaches both screen edges
// from md; the fallback card keeps the content width inside the frame.
export default async function HomePage() {
  const [meta, seo, sections, fees, address, contact, whatsappNumber, draftButtons] =
    await Promise.all([
      getTranslations("Metadata"),
      getTranslations("Seo"),
      getHomeSections(),
      getDeliveryFees(),
      getShopAddress(),
      getShopContact(),
      getWhatsappNumber(),
      canAddToDraft(),
    ]);
  const { siteUrl } = parsePublicEnv();
  const banners = sections.banners ?? [];
  const categories = sections.circles ?? [];
  const featured = sections.featured ?? [];
  const hero = heroChoice(sections.featured);
  const jumpTo = shopNowTarget(categories.length);
  // The `Store` block for local search (spec 0026 AC-9), from the same cached contact read.
  const store = storeFromContact(contact, {
    siteUrl,
    fallbackName: meta("title"),
    whatsappNumber: pickWhatsappNumber(contact.whatsappNumber),
    town: seo("town"),
  });

  return (
    <>
      {hero === "coverflow" ? (
        <HeroCoverflow products={featured} whatsappNumber={whatsappNumber} jumpTo={jumpTo} />
      ) : (
        <HeroCard whatsappNumber={whatsappNumber} jumpTo={jumpTo} />
      )}
      <PageFrame width="wide" className="flex flex-col pb-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(store) }}
        />

        {banners.length ? (
          // Under the hero (spec 0030 AC-12): the column's width below md, centred at most 720
          // wide from md.
          <div className="pt-6 md:mx-auto md:w-full md:max-w-(--prose-max)">
            <BannerCarousel banners={banners} />
          </div>
        ) : null}
        {categories.length ? (
          <CategoriesSection
            categories={categories}
            first={sections.categoryProducts}
            whatsappNumber={whatsappNumber}
            siteUrl={siteUrl}
            canAddToDraft={draftButtons}
          />
        ) : null}
        <TrustSection fees={fees} address={address} />
      </PageFrame>
    </>
  );
}
