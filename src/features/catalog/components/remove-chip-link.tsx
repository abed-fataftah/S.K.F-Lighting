import { X } from "lucide-react";
import { Link } from "@/i18n/navigation";

// The removable chip (design.md section 6) as a link: the list lives in the address, so taking a
// filter or the query off is a plain link to the address without it, and works without script
// (spec 0010 AC-5, AC-13). Its name says what it removes.
export function RemoveChipLink({
  href,
  label,
  removeLabel,
}: {
  readonly href: string;
  readonly label: string;
  readonly removeLabel: string;
}) {
  return (
    <Link
      href={href}
      aria-label={removeLabel}
      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-btn border border-control-border bg-white px-3.5 type-small text-ink hover:brightness-95"
    >
      <bdi>{label}</bdi>
      <X aria-hidden className="size-4" />
    </Link>
  );
}
