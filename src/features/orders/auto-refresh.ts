// The dashboard's live refresh rule (spec 0014 AC-16). Pure: `AutoRefresh` reads the clock, the
// tab's visibility, and whether the owner is busy, and asks this whether to refresh.
import { routes } from "@/lib/routes";

export const REFRESH_EVERY_MS = 60_000;

export function shouldRefresh(state: {
  readonly lastAt: number;
  readonly now: number;
  readonly visible: boolean;
  /** Typing in a field or working in a dialog: the next tick checks again. */
  readonly busy: boolean;
}): boolean {
  return state.visible && !state.busy && state.now - state.lastAt >= REFRESH_EVERY_MS;
}

const orderPrefix = `${routes.admin.orders}/`;

/** `/admin/orders/<number>`: leaving one refreshes at once, so its dot and the count clear. */
export function isOrderPagePath(pathname: string): boolean {
  if (!pathname.startsWith(orderPrefix)) return false;
  const rest = pathname.slice(orderPrefix.length);
  return rest !== "" && !rest.includes("/");
}
