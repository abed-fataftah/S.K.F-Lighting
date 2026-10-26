"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { activeTab, storefrontTabs } from "../nav";
import { tabIcons } from "./nav-icons";

// BottomBar (handoff section 6, spec 0003 AC-16): fixed to the bottom of the 480 column,
// above the phone's home indicator. Five equal tabs, a 24px icon over a 12px label; the
// current tab is bold ink with a 3px yellow underline and aria-current="page".
// `static` puts it in the page flow (the gallery); `pathname` overrides the current path.
// `cartCount` (lines in the cart, spec 0004 AC-4) badges the cart tab, as on the header; the
// badge is part of the tab's name, so what is seen is what is announced.
export function BottomBar({
  static: inFlow = false,
  pathname: forced,
  cartCount = 0,
}: {
  readonly static?: boolean;
  readonly pathname?: string;
  readonly cartCount?: number;
}) {
  const t = useTranslations("Shell");
  const pathname = usePathname();
  const current = activeTab(forced ?? pathname);
  const shownCount =
    cartCount > 0 ? (cartCount > 99 ? `${formatNumber(99)}+` : formatNumber(cartCount)) : null;

  return (
    <nav
      aria-label={t("mainNav")}
      className={cn(
        "box-content h-(--h-bottom-bar) border-t border-border bg-white",
        inFlow
          ? "relative"
          : "fixed start-0 end-0 bottom-0 z-(--z-bar) mx-auto max-w-(--page-max) pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex h-full px-1 pt-1.5 pb-2.5">
        {storefrontTabs.map(({ id, href }) => {
          const Icon = tabIcons[id];
          const active = id === current;
          return (
            <li key={id} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-btn type-caption",
                  active ? "font-extrabold text-ink" : "text-muted",
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-6" />
                  {id === "cart" && shownCount ? (
                    <Badge variant="count" className="absolute -end-3 -top-2">
                      {shownCount}
                    </Badge>
                  ) : null}
                </span>
                <span className={cn("border-b-3", active ? "border-yellow" : "border-transparent")}>
                  {t(`tabs.${id}`)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
