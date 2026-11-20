import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import type { MenuCategory } from "./menu-sheet";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { CartButton } from "./cart-button";
import { CategoryBar } from "./category-bar";
import { Logo } from "./logo";
import { MenuSheet } from "./menu-sheet";
import { tabIcons } from "./nav-icons";
import { SearchField, SearchInput } from "./search-field";

const AccountIcon = tabIcons.account;

// SiteHeader (handoff section 6, spec 0003 AC-12): not sticky. A black block with the menu
// button, the logo link home, and the cart; then the search box, a plain GET form to
// /search?q= that works without JavaScript; on /search it holds the query (spec 0010 AC-1). Focus outlines are orange here (.on-dark),
// except inside the white search box (.on-light).
// From lg (spec 0029 AC-4, AC-5) it is one row inside the content box: logo, search, the account
// link, and the cart, then the category bar. The top row dissolves into that row (lg:contents)
// and its menu button and cart hide; a second cart link after the account one keeps the tab
// order on the reading order at both widths. Only one cart link shows at a time. At lg the
// account link and the cart turn orange on hover, and the search box gets an orange edge on
// hover and while focused.
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
    <header className="on-dark bg-ink">
      <div className="mx-auto max-w-(--content-max) px-2 md:px-(--page-pad) lg:flex lg:items-center lg:gap-6 lg:py-3">
        <div className="flex items-center justify-between pt-2 pb-1.5 lg:contents">
          <MenuSheet
            whatsappNumber={whatsappNumber}
            categories={categories}
            triggerClassName="lg:hidden"
          />
          <Link href={routes.home} className="inline-flex shrink-0 rounded-btn">
            <Logo place="header" />
          </Link>
          <CartButton count={cartCount} className="lg:hidden" />
        </div>
        <form
          role="search"
          action={routes.search()}
          method="get"
          className="px-1.5 pt-1 pb-4 lg:mx-auto lg:max-w-160 lg:flex-1 lg:p-0"
        >
          <label className="on-light flex h-13 items-center rounded-card bg-white pe-1.5 lg:border-2 lg:border-transparent lg:transition-colors lg:duration-(--dur-hover) lg:focus-within:border-brand lg:hover:border-brand">
            <span className="sr-only">{t("searchLabel")}</span>
            <Suspense fallback={<SearchInput placeholder={t("searchPlaceholder")} />}>
              <SearchField placeholder={t("searchPlaceholder")} />
            </Suspense>
            <button
              type="submit"
              aria-label={t("searchSubmit")}
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-btn bg-brand text-ink"
            >
              <Search aria-hidden className="size-5.5" />
            </button>
          </label>
        </form>
        <Link
          href={routes.accountOrders}
          className="hidden min-h-11 shrink-0 items-center gap-2 rounded-btn px-2 type-body font-bold text-white transition-colors duration-(--dur-hover) hover:text-brand lg:inline-flex"
          data-testid="header-account"
        >
          <AccountIcon aria-hidden className="size-6" />
          {t("tabs.account")}
        </Link>
        <CartButton count={cartCount} className="hidden lg:inline-flex" />
      </div>
      {categories.length ? (
        <CategoryBar
          key={categories.map((category) => `${category.slug}:${category.name}`).join(" ")}
          categories={categories}
          whatsappNumber={whatsappNumber}
        />
      ) : null}
    </header>
  );
}
