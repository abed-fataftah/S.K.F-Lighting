import { getAccountProfile } from "@/features/accounts/server/profile";
import { handleQuickOrderSearch, searchQuickOrderProducts } from "@/features/drafts/server/search";
import { getDb } from "@/server/db";

// The product search behind each quick order line (spec 0020 AC-7). Electricians only; the proxy
// refreshes the session for this path, so the role is read fresh here.
export async function GET(request: Request) {
  return handleQuickOrderSearch(request, {
    account: getAccountProfile,
    search: async (terms) => searchQuickOrderProducts(await getDb(), terms),
  });
}
