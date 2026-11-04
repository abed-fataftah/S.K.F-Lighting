"use client";

import { ClipboardPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useProductSelection } from "@/features/catalog/components/product-selection";
import { AddToDraftSheet } from "./add-to-draft-sheet";

// "أضف إلى مسودة" on the product page (spec 0021 AC-2), between add to cart and WhatsApp, for
// electricians only. The sheet starts at the page's option and the stepper's quantity.
export function ProductAddToDraft() {
  const t = useTranslations("DraftPicker");
  const { data, selectedId, quantity } = useProductSelection();
  return (
    <AddToDraftSheet
      productId={data.id}
      name={data.name}
      code={data.code}
      startFrom={{ variantId: selectedId, quantity }}
      trigger={
        <Button
          variant="outline"
          size="lg"
          disabled={!data.inStock}
          data-testid="product-add-to-draft"
        >
          <ClipboardPlus aria-hidden />
          {t("trigger")}
        </Button>
      }
    />
  );
}
