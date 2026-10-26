import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { CardProduct } from "../card-view";
import { FocusNewCard } from "./focus-new-card";
import { ProductCard } from "./product-card";

// The product list parts shared by the category page and search (spec 0008 AC-11 to AC-13, spec
// 0010 AC-5, AC-6): the two column grid with `p-<position>` cards, the "shown N of M" line with
// "load more", and the six skeleton cards. Each page passes its own words and links.

export function ProductGrid({
  products,
  page,
  whatsappNumber,
  siteUrl,
  testId,
}: {
  readonly products: readonly CardProduct[];
  /** The current page, so focus moves to the first new card after "load more". */
  readonly page: number;
  readonly whatsappNumber: string;
  readonly siteUrl: string;
  readonly testId: string;
}) {
  return (
    <>
      <FocusNewCard page={page} />
      <ul className="grid grid-cols-2 gap-2.5" data-testid={testId}>
        {products.map((product, index) => (
          <li key={product.slug} className="flex">
            <ProductCard
              product={product}
              index={index}
              id={`p-${index + 1}`}
              whatsappNumber={whatsappNumber}
              siteUrl={siteUrl}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

/** "Shown N of M" and, while more remain, the "load more" link to the next page. */
export function ListMore({
  shownText,
  moreText,
  moreHref,
  testId,
}: {
  readonly shownText: string;
  readonly moreText: string;
  /** Null when every product is shown. */
  readonly moreHref: string | null;
  readonly testId: string;
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 pt-5.5">
      <p className="text-center type-small text-muted" data-testid={`${testId}-shown`}>
        {shownText}
      </p>
      {moreHref ? (
        <ButtonLink
          variant="outline"
          size="lg"
          className="h-12"
          render={<Link href={moreHref} scroll={false} />}
          data-testid={`${testId}-more`}
        >
          {moreText}
        </ButtonLink>
      ) : null}
    </div>
  );
}

/** Six skeleton cards while the products load, announced with `label`. */
export async function GridSkeleton({ label }: { readonly label?: string }) {
  const t = await getTranslations("Categories");
  return (
    <LoadingStatus label={label ?? t("loading")} className="grid grid-cols-2 gap-2.5">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-card border border-border bg-white"
        >
          <Skeleton className="h-(--h-card-image) rounded-none" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 w-full rounded-btn" />
          </div>
        </div>
      ))}
    </LoadingStatus>
  );
}
