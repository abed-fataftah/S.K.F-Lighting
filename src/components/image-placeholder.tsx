import { Lamp } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  1: "bg-product-1",
  2: "bg-product-2",
  3: "bg-product-3",
  4: "bg-product-4",
} as const;

// Stands in for a product photo until the owner's photos arrive (O-5): the dark product
// background with a lamp. Decorative, so hidden from screen readers; size it from outside.
export function ImagePlaceholder({
  tone = 1,
  className,
}: {
  readonly tone?: keyof typeof tones;
  readonly className?: string;
}) {
  return (
    <div
      aria-hidden
      data-slot="image-placeholder"
      className={cn("flex items-center justify-center", tones[tone], className)}
    >
      <Lamp className="size-12 text-on-dark-muted" strokeWidth={1.5} />
    </div>
  );
}
