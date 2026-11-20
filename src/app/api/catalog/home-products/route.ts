import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  categoryProductsFor,
  handleCategoryProducts,
} from "@/features/home/server/category-products";

// The eight products of a Home category card (spec 0031 AC-7). Public and rate limited with the
// catalog count's binding and budget; under `/api/catalog/`, so the proxy skips the session refresh.
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  return handleCategoryProducts(request, {
    limiter: (env as Partial<CloudflareEnv>).CATALOG_COUNT_RATE_LIMITER,
    products: categoryProductsFor,
    production: process.env.NODE_ENV === "production",
  });
}
