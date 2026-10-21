import { Lamp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { EmptyState } from "@/components/empty-state";
import { PageErrorState } from "@/components/error-state";
import { ButtonLink } from "@/components/ui/button";
import { ProductCard } from "@/features/catalog/components/product-card";
import { listHomeProducts } from "@/features/catalog/server/queries";
import { parsePublicEnv } from "@/lib/public-env";
import { whatsappUrl } from "@/lib/whatsapp";
import { withTimeLimit } from "@/server/db/time-limit";

// The grid is the whole page, so it waits longer than the footer's 1.5 seconds before giving up.
const HOME_READ_TIMEOUT_MS = 3000;

// A failed or slow read gives null: the page shows the error card (retry and WhatsApp) inside
// the shell instead of a 500. Logs say what went wrong, never the values.
async function loadHomeProducts() {
  const result = await withTimeLimit(listHomeProducts, HOME_READ_TIMEOUT_MS);
  if (result.ok) return result.data;
  console.error("listHomeProducts: read failed", { error: result.error });
  return null;
}

// A temporary home (spec 0004 AC-3): the newest sellable products, until feature 25 builds the
// real home page with its hero, categories, and featured products.
export default async function HomePage() {
  const [t, shell, products] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Shell"),
    loadHomeProducts(),
  ]);
  const { whatsappNumber } = parsePublicEnv();

  return (
    <div className="flex flex-col gap-4 px-(--page-pad) pt-5 pb-8">
      <header className="flex flex-col gap-1">
        <h1 className="type-title-l">{t("productsTitle")}</h1>
        <p className="type-small text-muted">{t("productsText")}</p>
      </header>

      {products === null ? (
        <PageErrorState whatsappNumber={whatsappNumber} />
      ) : products.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3" data-testid="home-products">
          {products.map((product, index) => (
            <li key={product.slug} className="flex">
              <ProductCard product={product} index={index} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Lamp}
          title={t("emptyTitle")}
          text={t("emptyText")}
          actions={
            <ButtonLink
              variant="whatsapp"
              size="lg"
              href={whatsappUrl(whatsappNumber, shell("whatsappMessages.general"))}
              target="_blank"
              rel="noopener"
            >
              <WhatsAppIcon />
              {t("emptyAsk")}
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
