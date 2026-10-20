import { useTranslations } from "next-intl";
import type { CartViewLine } from "../cart-view";

/** "الحجم: 60 سم · اللون: ذهبي", or nothing for a product without options. */
export function CartLineOptions({ line }: { readonly line: CartViewLine }) {
  const t = useTranslations("Cart");
  const parts = [
    line.sizeLabel ? t("size", { size: line.sizeLabel }) : null,
    line.colourName ? t("colour", { colour: line.colourName }) : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="type-small text-muted">{parts.join(" · ")}</p>;
}
