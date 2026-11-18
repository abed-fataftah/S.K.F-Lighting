import { Banknote, MessageCircle, Store, Truck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { circleSubline, type HomeCircle } from "../home-rules";
import { CategoryCircles, CircleShelf } from "./category-circles";
import { sectionHeadingId } from "../section-ids";

// Home's sections under the hero and the banners (spec 0011 AC-4, AC-6; pages/home.md layout 4,
// 7). Each heading takes focus from "تسوّق الآن" (`tabIndex={-1}`), so it needs an id from
// `sectionHeadingId`. The featured grid left with spec 0030: the picks are the hero coverflow.

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
      {/* The moving carousel on phones; from md a row with arrows (spec 0029 AC-13c). */}
      <div className="md:hidden">
        <CategoryCircles circles={circles} />
      </div>
      <CircleShelf circles={circles} className="hidden md:flex" />
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
      <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4" data-testid="home-trust">
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
