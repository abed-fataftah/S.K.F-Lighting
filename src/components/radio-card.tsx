"use client";

import type { ReactNode } from "react";
import { CheckRow } from "@/components/ui/check-row";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

// A radio choice as a card (design.md section 6): min height 56, radius 12. Unselected:
// white with a 1px control border. Selected: yellow tint fill with a 2px ink border. The
// padding gives back the extra pixel, so selecting never shifts the layout. The radio
// circle stays visible, so the choice is never shown by colour alone.
// Use inside a RadioGroup.
export function RadioCard({
  value,
  title,
  description,
  disabled,
  className,
}: {
  readonly value: string;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly className?: string;
}) {
  return (
    <CheckRow
      className={cn(
        "min-h-14 rounded-card border border-control-border bg-white px-3.5 py-2 has-data-checked:border-2 has-data-checked:border-ink has-data-checked:bg-yellow-tint has-data-checked:px-3.25 has-data-checked:py-1.75",
        disabled && "cursor-not-allowed bg-fill-muted text-muted",
        className,
      )}
    >
      <RadioGroupItem value={value} disabled={disabled} />
      <span className="flex flex-col">
        <span className="font-bold">{title}</span>
        {description ? <span className="type-small text-muted">{description}</span> : null}
      </span>
    </CheckRow>
  );
}
