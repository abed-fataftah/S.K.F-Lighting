"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { colourChips, selectedValues, sizeChips } from "../product-view";
import { useProductSelection } from "./product-selection";

// The options card (spec 0009 AC-2, AC-3; pages/product.md item 4): "الحجم" and "اللون" as single
// select chip groups that follow the size, then "الكمية". Out of stock: every chip disabled and no
// stepper (AC-7).
export function ProductOptions() {
  const t = useTranslations("Catalog");
  const shell = useTranslations("Shell");
  const { data, selectedId, quantity, setQuantity, chooseSize, chooseColour } =
    useProductSelection();
  const sizeHeading = useId();
  const colourHeading = useId();
  const quantityHeading = useId();
  const { size, colourId } = selectedValues(data.options, selectedId);
  const sizes = sizeChips(data.options);
  const colours = colourChips(data.options, size);
  if (!sizes.length && !colours.length && !data.inStock) return null;

  // Pressing the chip already pressed would empty the group: ignore it, the value stays.
  const onChange = (choose: (value: string) => void) => (value: readonly unknown[]) => {
    const [next] = value;
    if (typeof next === "string") choose(next);
  };
  const unavailable = <span>{t("optionUnavailable")}</span>;

  return (
    <Card className="gap-4 p-3.5" data-testid="product-options">
      {sizes.length ? (
        <section className="flex flex-col gap-2.5">
          <h2 id={sizeHeading} className="type-lead">
            {t("size")}
          </h2>
          <ToggleGroup
            aria-labelledby={sizeHeading}
            value={size === null ? [] : [size]}
            onValueChange={onChange(chooseSize)}
            data-testid="size-chips"
          >
            {sizes.map((chip) => (
              <ToggleGroupItem key={chip.label} value={chip.label} disabled={!chip.enabled}>
                <span>{chip.label}</span>
                {chip.enabled ? null : unavailable}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>
      ) : null}
      {colours.length ? (
        <section className="flex flex-col gap-2.5">
          <h2 id={colourHeading} className="type-lead">
            {t("colour")}
          </h2>
          <ToggleGroup
            aria-labelledby={colourHeading}
            value={colourId === null ? [] : [colourId]}
            onValueChange={onChange(chooseColour)}
            data-testid="colour-chips"
          >
            {colours.map((chip) => (
              <ToggleGroupItem key={chip.id} value={chip.id} disabled={!chip.enabled}>
                <span
                  aria-hidden
                  className="size-4.5 shrink-0 rounded-full border border-control-border"
                  // The swatch is catalog data (colours.hex), not a style token.
                  style={chip.hex ? { backgroundColor: chip.hex } : undefined}
                />
                <span>{chip.name}</span>
                {chip.enabled ? null : unavailable}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>
      ) : null}
      {data.inStock ? (
        <div className="flex items-center justify-between gap-3">
          <h2 id={quantityHeading} className="type-lead">
            {shell("quantity")}
          </h2>
          <QuantityStepper size="product" value={quantity} onValueChange={setQuantity} />
        </div>
      ) : null}
    </Card>
  );
}

// "أضف للسلة" for the selected pair (AC-8): ink with "added" for 2 seconds, then the cart link
// stays. Out of stock: a disabled button labelled "غير متوفر" (AC-7).
export function ProductAddToCart() {
  const t = useTranslations("Catalog");
  const { data, selectedId, added, addedOnce, problem, pending, add } = useProductSelection();

  if (!data.inStock || selectedId === null) {
    return (
      <Button size="lg" disabled data-testid="add-to-cart">
        {t("outOfStock")}
      </Button>
    );
  }

  const problemText = {
    cart_full: t("cartFull"),
    not_sellable: t("notSellable"),
    failed: t("addFailed"),
  };

  return (
    <>
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
        <Alert data-testid="add-problem">
          <AlertDescription>{problemText[problem]}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
