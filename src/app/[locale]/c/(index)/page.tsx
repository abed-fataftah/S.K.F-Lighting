import { ArrowLeft, FolderTree } from "lucide-react";
import Image from "next/image";
import { reportError } from "@/server/monitoring/report";
import { failureOf } from "@/server/monitoring/throttle";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { EmptyState } from "@/components/empty-state";
import { PageErrorState } from "@/components/error-state";
import { ButtonLink } from "@/components/ui/button";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { getCategoryCards } from "@/features/catalog/server/queries";
import { shareMetadata, shopImage } from "@/features/seo/share";
import { getWhatsappNumber } from "@/features/shell/server/shop-contact";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";
import { withTimeLimit } from "@/server/db/time-limit";
import { PageFrame } from "@/components/page-frame";

const CATEGORIES_READ_TIMEOUT_MS = 3000;
const tones = [1, 2, 3, 4] as const;

export async function generateMetadata(): Promise<Metadata> {
  const [t, meta, seo] = await Promise.all([
    getTranslations("Categories"),
    getTranslations("Metadata"),
    getTranslations("Seo"),
  ]);
  const { siteUrl } = parsePublicEnv();
  const canonical = `${siteUrl}${routes.categories}`;
  return {
    title: t("metaTitle"),
    description: meta("description"),
    alternates: { canonical },
    // The share title is the page's heading, with no site suffix (spec 0026 AC-5, AC-11).
    ...shareMetadata({
      siteName: meta("title"),
      title: t("title"),
      description: meta("description"),
      canonical,
      image: shopImage(siteUrl, seo("shopImageAlt")),
    }),
  };
}

// The categories page (spec 0008 AC-15): every main in navigation, with its count and its
// navigation subs. Not on the design boards; it reuses the card and link sizes of the others.
// The cards run 2 across, 3 from md, and 4 from lg. At the owner's request they are raised (3D)
// picture cards, the photo on top and the name under it, that lift and tilt on hover; the one
// place the design allows a shadow (.card-raised in globals.css).
export default async function CategoriesPage() {
  const [t, shell, result] = await Promise.all([
    getTranslations("Categories"),
    getTranslations("Shell"),
    withTimeLimit(getCategoryCards, CATEGORIES_READ_TIMEOUT_MS),
  ]);
  const whatsappNumber = await getWhatsappNumber();
  if (!result.ok) await reportError("navigation_read_failed", failureOf(result));

  return (
    <PageFrame width="wide" className="flex flex-col gap-4 px-(--page-pad) pt-5 pb-8">
      <h1 className="type-title-l">{t("title")}</h1>
      {!result.ok ? (
        <PageErrorState title={t("categoriesErrorTitle")} whatsappNumber={whatsappNumber} />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={t("noCategoriesTitle")}
          text={t("noCategoriesText")}
          actions={
            <ButtonLink
              variant="whatsapp"
              size="lg"
              href={whatsappUrl(whatsappNumber, shell("whatsappMessages.help"))}
              target="_blank"
              rel="noopener"
            >
              <WhatsAppIcon />
              {t("emptyAsk")}
            </ButtonLink>
          }
        />
      ) : (
        <ul
          className="grid grid-cols-2 gap-4 pb-2 md:grid-cols-3 md:gap-5 lg:grid-cols-4"
          data-testid="category-list"
        >
          {result.data.map((main, index) => (
            <li key={main.slug} className="flex">
              <article className="card-raised group/cat flex w-full flex-col overflow-hidden">
                <div className="card-raised-photo relative aspect-4/3 overflow-hidden">
                  {main.imageKey ? (
                    <Image
                      src={main.imageKey}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 300px, (min-width: 768px) 33vw, 50vw"
                      className="bg-product-1 object-cover"
                    />
                  ) : (
                    <ImagePlaceholder tone={tones[index % tones.length]} className="h-full" />
                  )}
                  <span className="absolute start-2 top-2 rounded-chip bg-ink px-2 py-1 type-caption font-extrabold text-white">
                    {t("count", { shown: formatNumber(main.productCount) })}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <h2 className="type-title-s">
                    <Link
                      href={routes.category(main.slug)}
                      className="flex min-h-11 items-center justify-between gap-2 after:absolute after:inset-0"
                    >
                      <span className="card-raised-name min-w-0 break-words">{main.name}</span>
                      <ArrowLeft
                        aria-hidden
                        className="card-raised-arrow size-5 shrink-0 ltr:rotate-180"
                      />
                    </Link>
                  </h2>
                  {main.subs.length ? (
                    <ul className="relative z-1 flex flex-wrap gap-x-3">
                      {main.subs.map((sub) => (
                        <li key={sub.slug}>
                          <Link
                            href={routes.subcategory(main.slug, sub.slug)}
                            className="inline-flex min-h-11 items-center type-small underline underline-offset-4"
                          >
                            {sub.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
