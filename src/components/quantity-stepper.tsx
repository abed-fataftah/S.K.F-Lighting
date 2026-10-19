"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { commitQuantity, MAX_QUANTITY, MIN_QUANTITY, stepQuantity } from "@/lib/quantity";
import { cn } from "@/lib/utils";

// The quantity stepper (design.md section 6): 1px ink border, radius 8, white; 44x44
// buttons and a typed value in between, announced politely. At 1 and 99 the buttons
// say aria-disabled instead of disabled, so keyboard focus is never thrown away.
// Controlled (value + onValueChange) or not (defaultValue).
export function QuantityStepper({
  value: controlled,
  defaultValue = MIN_QUANTITY,
  onValueChange,
  min = MIN_QUANTITY,
  max = MAX_QUANTITY,
  size = "cart",
  label,
  className,
}: {
  readonly value?: number;
  readonly defaultValue?: number;
  readonly onValueChange?: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  /** The value box is wider on the product page. */
  readonly size?: "cart" | "product";
  /** The value's accessible name, e.g. "الكمية: ثريا كريستال". Defaults to "الكمية". */
  readonly label?: string;
  readonly className?: string;
}) {
  const t = useTranslations("Shell");
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const [draft, setDraft] = useState<string | null>(null);

  const change = (next: number) => {
    setDraft(null);
    if (next === value) return;
    if (controlled === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };
  const commit = () => change(commitQuantity(draft ?? String(value), value, min, max));
  const atMin = value <= min;
  const atMax = value >= max;

  const stepButton =
    "flex size-11 shrink-0 cursor-pointer items-center justify-center text-ink aria-disabled:cursor-not-allowed aria-disabled:text-muted";

  return (
    <div
      data-slot="quantity-stepper"
      className={cn("inline-flex items-center rounded-btn border border-ink bg-white", className)}
    >
      <button
        type="button"
        aria-label={t("increase")}
        aria-disabled={atMax || undefined}
        onClick={() => !atMax && change(stepQuantity(value, 1, min, max))}
        className={stepButton}
      >
        <Plus aria-hidden className="size-5.5" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label ?? t("quantity")}
        aria-live="polite"
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
        className={cn(
          "h-11 bg-transparent text-center type-lead text-ink",
          size === "cart" ? "w-11" : "w-12",
        )}
      />
      <button
        type="button"
        aria-label={t("decrease")}
        aria-disabled={atMin || undefined}
        onClick={() => !atMin && change(stepQuantity(value, -1, min, max))}
        className={stepButton}
      >
        <Minus aria-hidden className="size-5.5" />
      </button>
    </div>
  );
}
