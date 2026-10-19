"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// An applied filter you can take off (design.md section 6): 44 high, radius 8, 13px,
// white, control border, the label then an x. Its name says what it removes.
export function RemovableChip({
  label,
  onRemove,
  className,
}: {
  readonly label: string;
  readonly onRemove: () => void;
  readonly className?: string;
}) {
  const t = useTranslations("Shell");

  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={t("remove", { label })}
      className={cn(
        "inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-btn border border-control-border bg-white px-3.5 type-small text-ink",
        className,
      )}
    >
      <span>{label}</span>
      <X aria-hidden className="size-4" />
    </button>
  );
}
