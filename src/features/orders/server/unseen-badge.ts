import "server-only";
import { withTimeLimit } from "@/server/db/time-limit";
import { countUnseenOrders } from "./admin-queries";

// The sidebar count (spec 0014 AC-15), read by the dashboard layout on every request. A slow or
// failing database never takes the dashboard down: past the limit the sidebar shows no badge.

export const UNSEEN_COUNT_LIMIT_MS = 1_500;

/** The number of unseen orders, or undefined (no badge) when the read timed out or failed. */
export async function unseenOrdersForSidebar(
  read: () => Promise<number> = countUnseenOrders,
): Promise<number | undefined> {
  const result = await withTimeLimit(read, UNSEEN_COUNT_LIMIT_MS);
  if (result.ok) return result.data;
  console.error(JSON.stringify({ event: "unseen_count_failed", error: result.error }));
  return undefined;
}
