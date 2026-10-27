import { isOrderNumber } from "@/features/orders/order-number";
import { routes } from "@/lib/routes";

// Which message the floating WhatsApp button sends (spec 0013 AC-9): W7 with the order number
// on a confirmation path, else W1. Pure; the path is the locale free one from `usePathname()`.

const confirmationPrefix = routes.checkoutDone("");

/** The order number in a `/checkout/done/<number>` path, or `null` on every other path. */
export function orderNumberInPath(pathname: string): string | null {
  const path = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (!path.startsWith(confirmationPrefix)) return null;
  const segment = path.slice(confirmationPrefix.length);
  if (segment === "" || segment.includes("/")) return null;

  let number: string;
  try {
    number = decodeURIComponent(segment);
  } catch {
    // A broken `%` sequence must never crash every storefront page.
    return null;
  }
  return isOrderNumber(number) ? number : null;
}
