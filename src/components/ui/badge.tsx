import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// design.md section 6: status badges (new, proc, ok, off), the read only spec chip,
// and the count badge. Radius 4. A status always carries its word, never colour alone.
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-chip border whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        new: "border-ink bg-yellow px-2 type-caption font-extrabold text-ink",
        proc: "border-ink bg-white px-2 type-caption font-extrabold text-ink",
        ok: "border-whatsapp bg-white px-2 type-caption font-extrabold text-whatsapp",
        off: "border-fill-muted bg-fill-muted px-2 type-caption font-extrabold text-muted",
        spec: "border-chip-border bg-white px-1.5 type-caption text-ink",
        count:
          "h-5 min-w-5 border-transparent bg-yellow px-1 type-caption leading-5 font-extrabold text-ink",
      },
    },
    defaultVariants: { variant: "proc" },
  },
);

function Badge({
  className,
  variant = "proc",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: { slot: "badge", variant },
  });
}

export { Badge, badgeVariants };
