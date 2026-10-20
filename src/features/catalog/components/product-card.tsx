import { useTranslations } from "next-intl";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Ltr } from "@/components/ltr";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";
import type { HomeProduct } from "../server/queries";

const tones = [1, 2, 3, 4] as const;

// The product card (design.md section 7) as slice 1 needs it: image, name link, code, list price,
// and the stock word. The whole card is one link; the add button row arrives with feature 25.
export function ProductCard({
  product,
  index,
}: {
  readonly product: HomeProduct;
  readonly index: number;
}) {
  const t = useTranslations("Catalog");

  return (
    <article className="relative flex w-full flex-col overflow-hidden rounded-card border border-border bg-white">
      <ImagePlaceholder tone={tones[index % tones.length]} className="h-(--h-card-image)" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h2 className="type-body font-extrabold">
          <Link
            href={routes.product(product.slug)}
            className="flex min-h-11 items-center rounded-btn after:absolute after:inset-0"
          >
            {product.name}
          </Link>
        </h2>
        <p className="type-caption text-muted">
          {t("codeLabel")} <Ltr>{product.code}</Ltr>
        </p>
        <p className="mt-auto flex items-baseline justify-between gap-2 pt-1">
          <span className="type-lead">
            <Ltr>{formatPrice(product.listPrice)}</Ltr>
          </span>
          <span className="type-caption font-bold text-whatsapp">{t("inStock")}</span>
        </p>
      </div>
    </article>
  );
}
