// Where to go after a correct TOTP code (spec 0004 AC-1): only a path inside the dashboard, never
// another site. `//evil.com`, `/admin\x`, `https://…`, and `/adminx` all fall back to the orders list.
import { routes } from "@/lib/routes";

export function safeAdminNext(next: string | null | undefined): string {
  if (!next) return routes.admin.orders;
  const isAdminPath =
    next === routes.admin.home ||
    next.startsWith(`${routes.admin.home}/`) ||
    next.startsWith(`${routes.admin.home}?`);
  const unsafe = next.includes("//") || next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next);
  return isAdminPath && !unsafe ? next : routes.admin.orders;
}
