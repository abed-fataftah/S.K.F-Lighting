import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// A filter chip that is a link (design.md section 6, Chip): the filter lives in the address, so a
// filtered list can be shared and works without script. The current one is yellow with a check
// and `aria-current`, so the choice never rests on colour alone.
export function FilterChipLink({
  href,
  current,
  children,
}: {
  readonly href: string;
  readonly current: boolean;
  readonly children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-btn border px-4 type-body whitespace-nowrap text-ink",
        current
          ? "border-ink bg-yellow font-extrabold"
          : "border-control-border bg-white hover:brightness-95",
      )}
    >
      {current ? <Check aria-hidden strokeWidth={3} className="size-4" /> : null}
      {children}
    </Link>
  );
}
