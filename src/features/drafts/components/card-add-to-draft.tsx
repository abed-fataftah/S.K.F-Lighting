"use client";

import { ClipboardPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AddToDraftSheet } from "./add-to-draft-sheet";

// The card's photo corner button (spec 0021 AC-3), for electricians only. It comes after the
// name link in the card, so it is its own focus stop and paints above the link's tap area.
export function CardAddToDraft({
  productId,
  name,
  code,
  disabled,
}: {
  readonly productId: string;
  readonly name: string;
  readonly code: string;
  /** Out of stock: nothing to add. */
  readonly disabled: boolean;
}) {
  const t = useTranslations("DraftPicker");
  return (
    <AddToDraftSheet
      productId={productId}
      name={name}
      code={code}
      startFrom={{ variantId: null, quantity: 1 }}
      trigger={
        <Button
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={t("cardLabel", { name })}
          className="absolute end-2 top-2 rounded-full border-border"
          data-testid="card-add-to-draft"
        >
          <ClipboardPlus aria-hidden />
        </Button>
      }
    />
  );
}
