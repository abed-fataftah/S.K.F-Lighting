"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, usePathname } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { fitCount, isCurrentCategory, splitCategories } from "../nav";
import type { MenuCategory } from "./menu-sheet";

type Widths = { readonly links: readonly number[]; readonly more: number; readonly gap: number };

const px = (value: string) => Number.parseFloat(value) || 0;

/** The row's width inside its side padding. */
function roomOf(row: HTMLElement): number {
  const style = getComputedStyle(row);
  return row.clientWidth - px(style.paddingInlineStart) - px(style.paddingInlineEnd);
}

// The desktop category bar (spec 0029 AC-5): from lg, a black row under the header with the
// navigation mains (the menu sheet's list, same order) as links, the current one marked. The
// links that do not fit move, in order, into a final "المزيد" menu that ends with "كل الأقسام".
// Hidden below lg, where the menu sheet lists them. The header leaves it out when the list is
// empty or its read failed.
//
// Until it measures, every link sits in the clipped row and the menu lists them all, so nothing
// shifts or is out of reach before hydration. Then it takes each link's width once (while all
// are in the row) and a ResizeObserver fits them to the row; the links past the count are
// `hidden`, so they leave the tab order and the accessibility tree. The header keys it by the
// list, so new categories mount it again and it measures afresh.
export function CategoryBar({ categories }: { readonly categories: readonly MenuCategory[] }) {
  const t = useTranslations("Shell");
  const pathname = usePathname();
  const rowRef = useRef<HTMLDivElement>(null);
  const widths = useRef<Widths | null>(null);
  const [visible, setVisible] = useState<number | null>(null);

  const fit = useCallback(() => {
    const row = rowRef.current;
    const sizes = widths.current;
    if (row && sizes) setVisible(fitCount(sizes.links, roomOf(row), sizes.more, sizes.gap));
  }, []);

  // Only while every link is in the row (none marked as moved) and the row shows: a font reset
  // can race the observer, and a hidden link measures 0.
  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row || row.clientWidth === 0 || row.querySelector("[data-moved]")) return;
    const list = row.querySelector("ul");
    const width = (element: Element | null) => element?.getBoundingClientRect().width ?? 0;
    widths.current = {
      links: Array.from(row.querySelectorAll("li"), width),
      more: width(row.querySelector("[data-testid=category-bar-more]")),
      gap: list ? px(getComputedStyle(list).columnGap) : 0,
    };
    fit();
  }, [fit]);

  useLayoutEffect(() => {
    if (visible === null) measure();
  }, [visible, measure]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    // Below lg the bar is not displayed (width 0); it measures the first time it shows.
    const observer = new ResizeObserver(() => (widths.current ? fit() : measure()));
    observer.observe(row);
    // A web font arriving after the first measure changes every width.
    let live = true;
    void document.fonts?.ready.then(() => {
      if (!live || !widths.current) return;
      widths.current = null;
      setVisible(null);
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [fit, measure]);

  const more = visible === null ? categories : splitCategories(categories, visible).more;

  return (
    <nav
      aria-label={t("menuCategories")}
      className="hidden lg:block"
      data-testid="category-bar"
      data-fitted={visible === null ? undefined : ""}
    >
      <div
        ref={rowRef}
        className="mx-auto flex h-(--h-cat-bar) max-w-(--content-max) items-center gap-1 px-(--page-pad)"
      >
        <ul className="flex h-full min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {categories.map((category, index) => {
            const current = isCurrentCategory(pathname, category.slug);
            const moved = visible !== null && index >= visible;
            return (
              <li
                key={category.slug}
                data-moved={moved ? "" : undefined}
                className={cn("shrink-0", moved && "hidden")}
              >
                <Link
                  href={routes.category(category.slug)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center rounded-btn px-3 type-body font-bold whitespace-nowrap hover:underline",
                    current ? "text-yellow" : "text-white",
                  )}
                >
                  {category.name}
                </Link>
              </li>
            );
          })}
        </ul>
        {more.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" className="shrink-0 gap-1.5 px-3 text-white" />}
              data-testid="category-bar-more"
            >
              {t("more")}
              <ChevronDown aria-hidden className="size-4.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {more.map((category) => (
                <DropdownMenuLinkItem
                  key={category.slug}
                  render={<Link href={routes.category(category.slug)} />}
                  aria-current={isCurrentCategory(pathname, category.slug) ? "page" : undefined}
                  className="aria-[current=page]:font-extrabold"
                >
                  {category.name}
                </DropdownMenuLinkItem>
              ))}
              <DropdownMenuLinkItem
                render={<Link href={routes.categories} />}
                className="border-t border-border font-extrabold"
              >
                {t("allCategories")}
              </DropdownMenuLinkItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </nav>
  );
}
