// Where to go after signing in or registering (spec 0017 AC-6): a storefront path only, never
// another site, the dashboard, an auth callback, or the sign in page itself. With no safe target,
// My Orders (spec 0018 AC-8).
import { routes } from "@/lib/routes";

const MAX_LENGTH = 512;
const BLOCKED_BASES = ["/admin", "/auth", routes.signIn] as const;
// `//`, a backslash, a tab, or any control character can turn a path into another host.
const UNSAFE = /\/\/|\\|[\u0000-\u001f\u007f]/;

const pathOf = (target: string) => target.split(/[?#]/, 1)[0];
const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

function decodeOnce(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** The path after the browser resolves `.` and `..` segments, so `/./admin` counts as `/admin`. */
function resolvedPath(target: string): string {
  return new URL(pathOf(target), "http://shop.invalid").pathname;
}

export function safeStorefrontNext(next: string | null | undefined): string {
  if (!next || next.length > MAX_LENGTH) return routes.accountOrders;
  const decoded = decodeOnce(next);
  if (decoded === null) return routes.accountOrders;

  const safe = [next, decoded].every(
    (form) => form.startsWith("/") && !UNSAFE.test(form) && !blocked(form),
  );
  return safe ? next : routes.accountOrders;
}

function blocked(target: string): boolean {
  const paths = [pathOf(target), resolvedPath(target)];
  return paths.some((path) => BLOCKED_BASES.some((base) => under(path, base)));
}
