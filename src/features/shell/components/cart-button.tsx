import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

// The header cart link (spec 0003, AC-14): 44x44, a white 26px cart. A yellow count badge
// shows only for a count above 0, capped at 99+; the count lives in the link's name, so the
// badge itself is hidden from screen readers. Feature 12 passes the count.
export function CartButton({ count }: { readonly count?: number }) {
  const t = useTranslations("Shell");
  const shown = count && count > 0 ? (count > 99 ? "99+" : String(count)) : null;

  return (
    <Link
      href={routes.cart}
      aria-label={shown ? t("cartWithCount", { count: count!, shown }) : t("cart")}
      className="relative inline-flex size-11 items-center justify-center rounded-btn text-white"
    >
      <ShoppingCart aria-hidden className="size-6.5" />
      {shown ? (
        <Badge variant="count" aria-hidden className="absolute end-0 top-0">
          {shown}
        </Badge>
      ) : null}
    </Link>
  );
}
