// Where to go after a correct TOTP code (spec 0004 AC-1): only a path inside the dashboard, never
// another site. `//evil.com`, `/admin\x`, `https://…`, and `/adminx` all fall back to the orders list.
import { routes } from "@/lib/routes";

/** Set by `proxy.ts` on `/admin` requests (overwriting any sent value), so a layout knows the path. */
export const ADMIN_PATH_HEADER = "x-admin-path";

export function safeAdminNext(next: string | null | undefined): string {
  if (!next) return routes.admin.orders;
  const isAdminPath =
    next === routes.admin.home ||
    next.startsWith(`${routes.admin.home}/`) ||
    next.startsWith(`${routes.admin.home}?`);
  const unsafe = next.includes("//") || next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next);
  return isAdminPath && !unsafe ? next : routes.admin.orders;
}

/**
 * `/admin/login` or `/admin/mfa` carrying where to go afterwards as `?next=`. The default
 * destination (the orders list) and anything `safeAdminNext` refuses leave the param off.
 */
export function withNext(path: string, next: string | null | undefined): string {
  const target = safeAdminNext(next);
  return target === routes.admin.orders && next !== routes.admin.orders
    ? path
    : `${path}?next=${encodeURIComponent(target)}`;
}
