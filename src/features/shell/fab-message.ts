import { isOrderNumber } from "@/features/orders/order-number";
import { routes } from "@/lib/routes";

// Which message the floating WhatsApp button sends (spec 0013 AC-9, spec 0015 AC-12): W7 with the
// order number on a confirmation or order page path, else W1. Pure; the path is the locale free
// one from `usePathname()`.

const orderPrefixes = [routes.checkoutDone(""), routes.order("")];

/** The order number in a `/checkout/done/<number>` or `/orders/<number>` path, else `null`. */
export function orderNumberInPath(pathname: string): string | null {
  const path = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const prefix = orderPrefixes.find((start) => path.startsWith(start));
  if (prefix === undefined) return null;
  const segment = path.slice(prefix.length);
  if (segment === "" || segment.includes("/")) return null;

  let number: string;
  try {
    number = decodeURIComponent(segment);
  } catch {
    // A broken `%` sequence must never crash every storefront page.
    return null;
  }
  // `/orders/track` fails here, so the lookup page sends W1.
  return isOrderNumber(number) ? number : null;
}
