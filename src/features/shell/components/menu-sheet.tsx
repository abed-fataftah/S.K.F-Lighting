"use client";

import { FileText, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { whatsappUrl } from "@/lib/whatsapp";
import { policyLinks, storefrontTabs } from "../nav";
import { tabIcons } from "./nav-icons";

const linkClass = "flex h-12 items-center gap-3 px-4 type-control text-ink";

// The header menu (spec 0003, AC-13): a sheet from the inline start side with the five
// tab links, the three policy links, and WhatsApp (W1). Focus starts on the close button,
// stays inside, and returns to the menu button on close. Feature 9 adds the categories.
export function MenuSheet({ whatsappNumber }: { readonly whatsappNumber: string }) {
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
