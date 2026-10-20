"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { addToCart } from "../server/actions";

const ADDED_MS = 2000;

type Problem = "cart_full" | "not_sellable" | "failed";

// The product page's quantity and add button (spec 0004 AC-3, AC-4). After adding, the button
// turns ink with "added" for 2 seconds (design.md section 7) and a link to the cart stays.
export function AddToCart({ variantId }: { readonly variantId: string }) {
  const t = useTranslations("Catalog");
  const shell = useTranslations("Shell");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  // The cart link stays once something was added, after the 2 second label has gone.
  const [addedOnce, setAddedOnce] = useState(false);
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
        const result = await addToCart(variantId, quantity);
        if (result.ok) {
          setAdded(true);
          setAddedOnce(true);
        } else setProblem(result.error === "invalid" ? "failed" : result.error);
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span aria-hidden className="type-lead">
          {shell("quantity")}
        </span>
        <QuantityStepper size="product" value={quantity} onValueChange={setQuantity} />
      </div>
      <Button
        size="lg"
        onClick={add}
        disabled={pending}
        data-testid="add-to-cart"
        className={cn(added && "border-ink bg-ink text-white hover:brightness-100")}
      >
        {added ? <Check aria-hidden /> : null}
        <span aria-live="polite">
          {added ? t("added") : pending ? t("adding") : t("addToCart")}
        </span>
      </Button>
      {addedOnce ? (
        <ButtonLink variant="outline" size="lg" render={<Link href={routes.cart} />}>
          {t("viewCart")}
        </ButtonLink>
      ) : null}
      {problem ? (
        <Alert>
          <AlertDescription>{problemText[problem]}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
