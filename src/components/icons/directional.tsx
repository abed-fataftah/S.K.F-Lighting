import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

// Icons that point along the reading direction flip in right to left (design.md section 8).
// Named by meaning, not by side: "next" points toward the end of the line, "back" toward
// its start. Cart, search, WhatsApp, trash, check, close, filter, and play never flip:
// use them from lucide directly.
function flipped(Icon: ComponentType<LucideProps>, name: string) {
  function DirectionalIcon({ className, ...props }: LucideProps) {
    return <Icon aria-hidden className={cn("rtl:-scale-x-100", className)} {...props} />;
  }
  DirectionalIcon.displayName = name;
  return DirectionalIcon;
}

export const ChevronNext = flipped(ChevronRight, "ChevronNext");
export const ChevronBack = flipped(ChevronLeft, "ChevronBack");
export const ArrowNext = flipped(ArrowRight, "ArrowNext");
export const ArrowBack = flipped(ArrowLeft, "ArrowBack");
