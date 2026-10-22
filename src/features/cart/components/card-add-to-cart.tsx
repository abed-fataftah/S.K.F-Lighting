"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addToCart } from "../server/actions";

const ADDED_MS = 2000;

type Problem = "cart_full" | "not_sellable" | "failed";

// The product card's "add to cart" (spec 0008 AC-12, design.md section 7): one unit of the card
// variant through the same `addToCart` action as the product page. The button turns ink with
// "تمت الإضافة" for 2 seconds; a refusal shows the cart's own message under the card's buttons.
export function CardAddToCart({
  variantId,
  name,
}: {
  readonly variantId: string;
  readonly name: string;
}) {
  const t = useTranslations("Catalog");
  const [added, setAdded] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), ADDED_MS);
    return () => clearTimeout(timer);
  }, [added]);

  const add = () =>
    startTransition(async () => {
      setProblem(null);
      try {
        const result = await addToCart(variantId, 1);
        if (result.ok) setAdded(true);
        else setProblem(result.error === "invalid" ? "failed" : result.error);
      } catch {
        setProblem("failed");
      }
    });

  const problemText = {
    cart_full: t("cartFull"),
    not_sellable: t("notSellable"),
    failed: t("addFailed"),
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Button
        onClick={add}
        disabled={pending}
        data-testid="card-add-to-cart"
        className={cn("w-full px-2", added && "border-ink bg-ink text-white hover:brightness-100")}
      >
        {added ? <Check aria-hidden /> : null}
        <span aria-live="polite">{added ? t("cardAdded") : t("addToCart")}</span>
        {/* The visible words stay first in the name; the product tells the cards apart. */}
        <span className="sr-only">{t("cardProduct", { name })}</span>
      </Button>
      {problem ? (
        <p role="alert" className="type-caption font-bold text-danger">
          {problemText[problem]}
        </p>
      ) : null}
    </div>
  );
}
