"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Button } from "@/components/ui/button";
import { removeFromCart, setCartQuantity } from "../server/actions";

// A cart line's controls (spec 0004 AC-4, AC-5). Each change is a Server Action that rewrites the
// cookie; Next then renders the page again, so totals and the count come from the server.

export function RemoveLineButton({
  variantId,
  name,
}: {
  readonly variantId: string;
  readonly name: string;
}) {
  const t = useTranslations("Cart");
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("remove", { name })}
      disabled={pending}
      onClick={() => startTransition(() => removeFromCart(variantId).then(() => undefined))}
      className="-me-2.5 -mt-2.5 text-muted hover:text-ink"
    >
      <Trash2 aria-hidden />
    </Button>
  );
}

export function LineQuantity({
  variantId,
  quantity,
  name,
}: {
  readonly variantId: string;
  readonly quantity: number;
  readonly name: string;
}) {
  const t = useTranslations("Cart");
  const [shown, setShown] = useOptimistic(quantity);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  const change = (next: number) =>
    startTransition(async () => {
      setFailed(false);
      setShown(next);
      const result = await setCartQuantity(variantId, next).catch(() => null);
      if (!result?.ok) setFailed(true);
    });

  return (
    <div className="flex flex-col gap-1">
      <QuantityStepper value={shown} onValueChange={change} label={t("quantityFor", { name })} />
      {failed ? (
        <p role="alert" className="type-caption font-bold text-danger">
          {t("updateFailed")}
        </p>
      ) : null}
    </div>
  );
}
