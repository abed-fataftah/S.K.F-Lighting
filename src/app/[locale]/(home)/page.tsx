import { getTranslations } from "next-intl/server";
import { getShopAddress } from "@/features/shell/server/shop-contact";
import { BannerCarousel } from "@/features/home/components/banner-carousel";
import { HeroCard } from "@/features/home/components/hero-card";
import {
  CategoriesSection,
  FeaturedSection,
  TrustSection,
} from "@/features/home/components/home-sections";
import { buildZoneLine } from "@/features/home/fees";
import { shopNowTarget } from "@/features/home/home-rules";
import { getDeliveryFees, getHomeSections } from "@/features/home/server/home";
import { parsePublicEnv } from "@/lib/public-env";

// Home (spec 0011 AC-1): the banners or the hero, the category circles, the featured products,
// and the trust cards, inside the shop layout's strip, header, and footer. Every part is read
// together and stands alone: a part whose read failed is null and only that part is gone (AC-7).
// The page has one `h1`: the hero's headline, else a hidden one with the shop's name.
export default async function HomePage() {
  const [t, sections, fees, address] = await Promise.all([
    getTranslations("Home"),
    getHomeSections(),
    getDeliveryFees(),
    getShopAddress(),
  ]);
  const { whatsappNumber, siteUrl } = parsePublicEnv();
  const banners = sections.banners ?? [];
  const circles = sections.circles ?? [];
  const featured = sections.featured ?? [];

  return (
    <div className="flex flex-col pt-3.5 pb-8">
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
        <FeaturedSection products={featured} whatsappNumber={whatsappNumber} siteUrl={siteUrl} />
      ) : null}
      <TrustSection zoneLine={buildZoneLine(fees)} address={address} />
    </div>
  );
}
