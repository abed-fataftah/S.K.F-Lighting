"use client";

import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ButtonLink } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/whatsapp";
import { productLink, selectionText } from "../product-view";
import { useProductSelection } from "./product-selection";

// The green WhatsApp buttons (spec 0009 AC-9): W3 with the selected size and colour and the link
// that opens the same choice; out of stock, both ask about availability with W4 and the bare link
// (AC-7). `place` picks the large button under add to cart or the help card's small one.
export function ProductWhatsApp({
  place,
  whatsappNumber,
  siteUrl,
}: {
  readonly place: "buy" | "help";
  readonly whatsappNumber: string;
  readonly siteUrl: string;
}) {
  const t = useTranslations("Catalog");
  const { data, selectedId } = useProductSelection();
  const inStock = data.inStock && selectedId !== null;
  const options = selectionText(data.options, selectedId);
  const text = inStock
    ? t("whatsappProduct", {
        name: data.name,
        code: data.code,
        options: options ? ` ${options}` : "",
        link: productLink(siteUrl, data, selectedId),
      })
    : t("whatsappAvailability", {
        name: data.name,
        code: data.code,
        link: productLink(siteUrl, data, null),
      });
  const label = !inStock
    ? t("askAvailability")
    : place === "buy"
      ? t("orderOnWhatsapp")
      : t("helpButton");

  return (
    <ButtonLink
      variant="whatsapp"
      size={place === "buy" ? "lg" : undefined}
      href={whatsappUrl(whatsappNumber, text)}
      target="_blank"
      rel="noopener"
      data-testid={`product-whatsapp-${place}`}
    >
      <WhatsAppIcon />
      {label}
    </ButtonLink>
  );
}
