"use client";

import { useTranslations } from "next-intl";
import { Ltr } from "@/components/ltr";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { priceLine } from "../product-view";
import { useProductSelection } from "./product-selection";

// The selected pair's price and "· للحجم <size>" (spec 0009 AC-5), updated in the browser as the
// chips change; muted with no note when out of stock (AC-7).
export function ProductPrice() {
  const t = useTranslations("Catalog");
  const { data, selectedId } = useProductSelection();
  const line = priceLine(data.options, selectedId, data.mutedPrice);

  return (
    <p aria-live="polite" className="flex items-baseline gap-2">
      {line.price !== null ? (
        <span className={cn("type-price", line.muted && "text-muted")} data-testid="product-price">
          <Ltr>{formatPrice(line.price)}</Ltr>
        </span>
      ) : null}
      {line.size ? (
        <span className="type-small text-muted" data-testid="product-size-note">
          {t("sizeNote", { size: line.size })}
        </span>
      ) : null}
    </p>
  );
}
