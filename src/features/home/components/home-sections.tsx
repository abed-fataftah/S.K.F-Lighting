import { Banknote, MessageCircle, Store, Truck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { CardProduct } from "@/features/catalog/card-view";
import { ProductCard } from "@/features/catalog/components/product-card";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { circleSubline, type HomeCircle } from "../home-rules";
import { CategoryCircles } from "./category-circles";
import { sectionHeadingId } from "../section-ids";

// Home's sections under the banners (spec 0011 AC-4 to AC-6; pages/home.md layout 4, 6, 7). Each
// heading takes focus from "تسوّق الآن" (`tabIndex={-1}`), so it needs an id from `sectionHeadingId`.

function SectionHeading({
  section,
  children,
}: {
  readonly section: string;
  readonly children: ReactNode;
}) {
  return (
    <h2 id={sectionHeadingId(section)} tabIndex={-1} className="scroll-mt-4 type-title-m">
      {children}
    </h2>
  );
}

/** "تسوّق حسب القسم": the circles and the first six names; hidden with no circle. */
export function CategoriesSection({ circles }: { readonly circles: readonly HomeCircle[] }) {
  const t = useTranslations("Home");
  return (
    <section
      id="categories"
      aria-labelledby={sectionHeadingId("categories")}
      className="flex flex-col gap-1 pt-7.5 pb-2 text-center"
    >
      <div className="flex flex-col gap-1 px-6 pb-5">
        <SectionHeading section="categories">{t("categoriesTitle")}</SectionHeading>
        <p className="type-small text-muted">{circleSubline(circles)}</p>
      </div>
      <CategoryCircles circles={circles} />
    </section>
  );
}

/** "منتجات مختارة": the picks or the newest products, two per row (AC-5). */
export function FeaturedSection({
  products,
  whatsappNumber,
  siteUrl,
}: {
  readonly products: readonly CardProduct[];
  readonly whatsappNumber: string;
  readonly siteUrl: string;
}) {
  const t = useTranslations("Home");
  return (
    <section
      id="featured"
      aria-labelledby={sectionHeadingId("featured")}
      className="flex flex-col gap-3 px-(--page-pad) pt-8.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <SectionHeading section="featured">{t("featuredTitle")}</SectionHeading>
        <Link
          href={routes.categories}
          className="inline-flex min-h-11 items-center type-small text-muted underline underline-offset-4"
        >
          {t("viewAll")}
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-2.5" data-testid="home-products">
        {products.map((product, index) => (
          <li key={product.slug} className="flex">
            <ProductCard
              product={product}
              index={index}
              whatsappNumber={whatsappNumber}
              siteUrl={siteUrl}
              heading="h3"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TrustCard({
  icon: Icon,
  title,
  line,
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly line: string | null;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-card border border-border bg-white p-3.5">
      <span className="flex size-10 items-center justify-center rounded-tile bg-yellow text-ink">
        <Icon aria-hidden className="size-5.5" />
      </span>
      <h3 className="type-lead">{title}</h3>
      {line ? <p className="type-small text-muted">{line}</p> : null}
    </li>
  );
}

/**
 * "لماذا تشتري من S.K.F": four cards in a 2×2 grid (AC-6). The delivery line is the zone list
 * (none with no active zone), the pickup line the shop's address or its fallback.
 */
export function TrustSection({
  zoneLine,
  address,
}: {
  readonly zoneLine: string | null;
  readonly address: string | null;
}) {
  const t = useTranslations("Home");
  return (
    <section aria-labelledby="trust-title" className="flex flex-col gap-3 px-(--page-pad) pt-8.5">
      <h2 id="trust-title" className="type-title-m">
        {t("trustTitle")}
      </h2>
      <ul className="grid grid-cols-2 gap-2.5" data-testid="home-trust">
        <TrustCard icon={Truck} title={t("trustDelivery")} line={zoneLine} />
        <TrustCard icon={Banknote} title={t("trustPay")} line={t("trustPayText")} />
        <TrustCard icon={MessageCircle} title={t("trustMessage")} line={null} />
        <TrustCard
          icon={Store}
          title={t("trustPickup")}
          line={address ?? t("trustPickupFallback")}
        />
      </ul>
    </section>
  );
}
