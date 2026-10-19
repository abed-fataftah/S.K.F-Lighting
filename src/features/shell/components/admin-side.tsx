"use client";

import { Store } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { activeAdminLink, adminLinks } from "../nav";
import { Logo } from "./logo";
import { adminIcons } from "./nav-icons";

// AdminSide (handoff section 6, spec 0003 AC-18): the black dashboard sidebar. Logo and
// caption, eight links 48 high, then "عرض المتجر". The current link has the active fill, a
// 4px yellow bar on the inline start edge, and aria-current="page". In the dashboard's
// flex row it takes 220px up to 260px and wraps above the content below 780px.
// The /admin layout and its guard come with the first dashboard page (feature 6).
// `pathname` overrides the current path (the gallery).
export function AdminSide({
  pathname: forced,
  className,
}: {
  readonly pathname?: string;
  readonly className?: string;
}) {
  const t = useTranslations("AdminShell");
  const pathname = usePathname();
  const current = activeAdminLink(forced ?? pathname);

  return (
    <aside
      className={cn(
        "on-dark flex flex-[1_1_var(--admin-sidebar-basis)] flex-col bg-ink pt-5 pb-6 text-on-dark-muted",
        "max-w-(--admin-sidebar-max)",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-1 px-5 pb-4.5">
        <Logo place="sidebar" />
        <p className="type-caption">{t("caption")}</p>
      </div>
      <nav aria-label={t("nav")}>
        <ul className="flex flex-col">
          {adminLinks.map(({ id, href }) => {
            const Icon = adminIcons[id];
            const active = id === current;
            return (
              <li key={id}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-12 items-center gap-3 px-5 type-body",
                    active &&
                      "bg-sidebar-active font-extrabold text-white before:absolute before:inset-y-0 before:start-0 before:w-1 before:bg-yellow",
                  )}
                >
                  <Icon aria-hidden className="size-5.5 shrink-0" />
                  {t(`links.${id}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="px-5 pt-4.5">
        <Link
          href={routes.home}
          className="flex h-11 items-center justify-center gap-2 rounded-btn border border-on-dark-muted type-body font-bold text-white"
        >
          <Store aria-hidden className="size-5" />
          {t("viewStore")}
        </Link>
      </div>
    </aside>
  );
}
