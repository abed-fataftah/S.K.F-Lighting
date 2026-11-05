import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The type roles and token names from src/app/tokens.css (spec 0003).
export const typeRoles = [
  "caption",
  "small",
  "body",
  "control",
  "lead",
  "title-s",
  "title-m",
  "title-l",
  "display-s",
  "price",
  "kpi",
  "hero",
  "404",
  "prose",
] as const;

const colourNames = [
  "ink",
  "yellow",
  "yellow-tint",
  "white",
  "page",
  "muted",
  "border",
  "control-border",
  "chip-border",
  "fill-muted",
  "on-dark-muted",
  "sidebar-active",
  "whatsapp",
  "danger",
  "product-1",
  "product-2",
  "product-3",
  "product-4",
  "swatch-gold",
  "swatch-chrome",
  "swatch-wood",
  "background",
  "foreground",
  "card",
  "popover",
  "primary",
  "primary-foreground",
  "secondary",
  "muted-foreground",
  "accent",
  "destructive",
  "input",
  "ring",
];

const twMerge = extendTailwindMerge<"type">({
  extend: {
    // type-* is one group, so a caller's `type-caption` replaces a component's `type-control`.
    classGroups: { type: [{ type: [...typeRoles] }] },
    theme: {
      color: colourNames,
      radius: ["chip", "btn", "tile", "card", "hero"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
