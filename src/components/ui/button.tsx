import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// design.md section 6. Focus comes from the global rule in tokens.css, never a ring here.
// A loading button is the caller's job: pass `disabled` and swap the label.
// For a link, use `render={<Link href="…" />}` with `nativeButton={false}`.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border border-transparent whitespace-nowrap select-none data-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5.5",
  {
    variants: {
      variant: {
        default:
          "border-ink bg-yellow text-ink hover:brightness-95 active:brightness-90 data-disabled:border-fill-muted data-disabled:bg-fill-muted data-disabled:text-muted data-disabled:brightness-100 data-[preview=hover]:brightness-95 data-[preview=pressed]:brightness-90",
        whatsapp: "bg-whatsapp text-white data-disabled:bg-fill-muted data-disabled:text-muted",
        outline:
          "border-ink bg-white text-ink hover:brightness-95 active:brightness-90 data-disabled:border-fill-muted data-disabled:bg-fill-muted data-disabled:text-muted data-disabled:brightness-100 data-[preview=hover]:brightness-95 data-[preview=pressed]:brightness-90",
        link: "text-ink underline underline-offset-4",
        ghost: "bg-transparent text-current",
      },
      size: {
        lg: "h-13 rounded-card px-4 type-lead",
        sm: "h-11 rounded-btn px-4 type-body font-extrabold",
        icon: "size-11 rounded-btn p-0",
      },
    },
    compoundVariants: [
      { variant: "whatsapp", size: "lg", className: "type-control font-extrabold" },
      { variant: "whatsapp", size: "sm", className: "font-bold" },
      { variant: "outline", size: "lg", className: "type-control font-bold" },
      { variant: "outline", size: "sm", className: "font-bold" },
      {
        variant: "link",
        className: "h-auto min-h-11 rounded-none border-0 px-0 type-body",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "sm",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
