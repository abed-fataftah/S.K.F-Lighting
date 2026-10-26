"use client";

import { FileText, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";
import { policyLinks, storefrontTabs } from "../nav";
import { tabIcons } from "./nav-icons";

const linkClass = "flex h-12 items-center gap-3 px-4 type-control text-ink";

/** A main category in navigation, as the server shell passes it down. */
export type MenuCategory = { readonly slug: string; readonly name: string };

// The header menu (spec 0003, AC-13): a sheet from the inline start side with the five
// tab links, the categories in navigation (spec 0008 AC-14), the three policy links, and WhatsApp
// (W1). Focus starts on the close button, stays inside, and returns to the menu button on close.
// The categories come from the server shell, which reads them once per request.
export function MenuSheet({
  whatsappNumber,
  categories = [],
}: {
  readonly whatsappNumber: string;
  readonly categories?: readonly MenuCategory[];
}) {
  const t = useTranslations("Shell");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="text-white" />}
        aria-label={t("menu")}
      >
        <Menu aria-hidden className="size-6.5" />
      </SheetTrigger>
      <SheetContent closeLabel={t("close")}>
        <SheetHeader>
          <SheetTitle>{t("menuTitle")}</SheetTitle>
        </SheetHeader>
        <nav aria-label={t("menuTitle")} className="flex flex-col pb-6">
          <ul className="flex flex-col border-b border-border py-2">
            {storefrontTabs.map(({ id, href }) => {
              const Icon = tabIcons[id];
              return (
                <li key={id}>
                  <Link href={href} onClick={close} className={linkClass}>
                    <Icon aria-hidden className="size-5.5" />
                    {t(`tabs.${id}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
          {categories.length ? (
            <section aria-labelledby="menu-categories" className="border-b border-border py-2">
              <h2 id="menu-categories" className="px-4 pt-2 type-caption font-extrabold text-muted">
                {t("menuCategories")}
              </h2>
              <ul className="flex flex-col" data-testid="menu-categories">
                {categories.map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={routes.category(category.slug)}
                      onClick={close}
                      className={linkClass}
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <ul className="flex flex-col border-b border-border py-2">
            {policyLinks.map(({ id, href }) => (
              <li key={id}>
                <Link href={href} onClick={close} className={linkClass}>
                  <FileText aria-hidden className="size-5.5" />
                  {t(`policies.${id}`)}
                </Link>
              </li>
            ))}
          </ul>
          <a
            href={whatsappUrl(whatsappNumber, t("whatsappMessages.general"))}
            target="_blank"
            rel="noopener"
            className={`${linkClass} mt-2`}
          >
            <WhatsAppIcon className="size-5.5 text-whatsapp" />
            {t("menuWhatsapp")}
          </a>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
