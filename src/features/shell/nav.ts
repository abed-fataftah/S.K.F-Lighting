import { routes } from "@/lib/routes";

// The shell's links and which one is current (spec 0003, Value sourcing). Pure data and
// rules; the components pick the icons and the words.

export type TabId = "home" | "cats" | "cart" | "search" | "account";

export const storefrontTabs: readonly { readonly id: TabId; readonly href: string }[] = [
  { id: "home", href: routes.home },
  { id: "cats", href: routes.categories },
  { id: "cart", href: routes.cart },
  { id: "search", href: routes.search() },
  // Always the orders page: the account area sends a signed out visitor to sign in.
  { id: "account", href: routes.accountOrders },
];

export type PolicyId = "privacy" | "terms" | "returns";

export const policyLinks: readonly { readonly id: PolicyId; readonly href: string }[] = [
  { id: "privacy", href: routes.privacy },
  { id: "terms", href: routes.terms },
  { id: "returns", href: routes.returns },
];

export type AdminLinkId =
  "home" | "orders" | "customers" | "reports" | "products" | "categories" | "homepage" | "settings";

export const adminLinks: readonly { readonly id: AdminLinkId; readonly href: string }[] = [
  { id: "home", href: routes.admin.home },
  { id: "orders", href: routes.admin.orders },
  { id: "customers", href: routes.admin.customers },
  { id: "reports", href: routes.admin.reports },
  { id: "products", href: routes.admin.products },
  { id: "categories", href: routes.admin.categories },
  { id: "homepage", href: routes.admin.homepage },
  { id: "settings", href: routes.admin.settings },
];

/** True when `pathname` is `base` or sits under it (`/c` matches `/c/lamps`, not `/cart`). */
function under(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

const tabRules: readonly (readonly [TabId, readonly string[]])[] = [
  ["cart", ["/cart", "/checkout"]],
  ["cats", ["/c", "/p"]],
  ["search", ["/search"]],
  ["account", ["/account", "/orders"]],
];

/** The bottom bar tab for a storefront path; home for `/` and everything else. */
export function activeTab(pathname: string): TabId {
  const match = tabRules.find(([, bases]) => bases.some((base) => under(pathname, base)));
  return match ? match[0] : "home";
}

/** The dashboard link for an admin path: the longest matching one; `/admin` only exactly. */
export function activeAdminLink(pathname: string): AdminLinkId | null {
  const matches = adminLinks.filter(({ href }) =>
    href === routes.admin.home ? pathname === href : under(pathname, href),
  );
  const longest = matches.reduce<(typeof adminLinks)[number] | null>(
    (best, link) => (best && best.href.length >= link.href.length ? best : link),
    null,
  );
  return longest?.id ?? null;
}
