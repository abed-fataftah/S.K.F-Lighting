"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { isCurrentCategory, splitCategories } from "../nav";
import type { MenuCategory } from "./menu-sheet";

// First version (spec 0029 build plan task 5): a fixed count in the row; task 8 measures instead.
const SHOWN_IN_ROW = 6;

// The desktop category bar (spec 0029 AC-5): from lg, a black row under the header with the
// navigation mains (the menu sheet's list, same order) as links, the current one marked. The
// rest sit in a final "المزيد" menu that ends with "كل الأقسام". Hidden below lg, where the
// menu sheet lists them. The header leaves it out when the list is empty or its read failed.
export function CategoryBar({ categories }: { readonly categories: readonly MenuCategory[] }) {
  const t = useTranslations("Shell");
  const pathname = usePathname();
  const { shown, more } = splitCategories(categories, SHOWN_IN_ROW);

  return (
    <nav aria-label={t("menuCategories")} className="hidden lg:block" data-testid="category-bar">
      <div className="mx-auto flex h-(--h-cat-bar) max-w-(--content-max) items-center gap-1 px-(--page-pad)">
        <ul className="flex h-full min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {shown.map((category) => {
            const current = isCurrentCategory(pathname, category.slug);
            return (
              <li key={category.slug} className="shrink-0">
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
