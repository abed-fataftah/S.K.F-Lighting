"use client";

import type { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

// A filter or option chip (design.md section 6): a ToggleGroup item with aria-pressed.
// Selected shows a 16px check before the label, so selection never rests on colour alone.
// Disabled strikes the label through and says "غير متوفر".
export function Chip({ className, children, disabled, ...props }: TogglePrimitive.Props) {
  const t = useTranslations("Shell");

  return (
    <ToggleGroupItem
      disabled={disabled}
      className={cn("group/chip data-disabled:no-underline", className)}
      {...props}
    >
      <Check aria-hidden strokeWidth={3} className="hidden group-data-pressed/chip:block" />
      <span className="group-data-disabled/chip:line-through">{children}</span>
      {disabled ? <span className="type-caption">· {t("unavailable")}</span> : null}
    </ToggleGroupItem>
  );
}
