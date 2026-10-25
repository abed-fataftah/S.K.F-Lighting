import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import type { MenuCategory } from "./menu-sheet";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { CartButton } from "./cart-button";
import { Logo } from "./logo";
import { MenuSheet } from "./menu-sheet";
import { SearchField, SearchInput } from "./search-field";

// SiteHeader (handoff section 6, spec 0003 AC-12): not sticky. A black block with the menu
// button, the logo link home, and the cart; then the search box, a plain GET form to
// /search?q= that works without JavaScript; on /search it holds the query (spec 0010 AC-1). Focus outlines are yellow here (.on-dark),
// except inside the white search box (.on-light).
export function SiteHeader({
  whatsappNumber,
  cartCount,
  categories = [],
}: {
  readonly whatsappNumber: string;
  readonly cartCount?: number;
  /** The navigation mains for the menu (spec 0008 AC-14); empty hides the list. */
  readonly categories?: readonly MenuCategory[];
}) {
  const t = useTranslations("Shell");

  return (
    <header className="on-dark bg-ink px-2">
      <div className="flex items-center justify-between pt-2 pb-1.5">
        <MenuSheet whatsappNumber={whatsappNumber} categories={categories} />
        <Link href={routes.home} className="inline-flex rounded-btn">
          <Logo place="header" />
        </Link>
        <CartButton count={cartCount} />
      </div>
      <form role="search" action={routes.search()} method="get" className="px-1.5 pt-1 pb-4">
        <label className="on-light flex h-13 items-center rounded-card bg-white pe-1.5">
          <span className="sr-only">{t("searchLabel")}</span>
          <Suspense fallback={<SearchInput placeholder={t("searchPlaceholder")} />}>
            <SearchField placeholder={t("searchPlaceholder")} />
          </Suspense>
          <button
            type="submit"
            aria-label={t("searchSubmit")}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-btn bg-yellow text-ink"
          >
            <Search aria-hidden className="size-5.5" />
          </button>
        </label>
      </form>
    </header>
  );
}
