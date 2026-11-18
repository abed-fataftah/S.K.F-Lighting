import { tidyText } from "@/lib/arabic";

// The params of `GET /api/catalog/home-products` (spec 0031 AC-7): exactly one `category` param,
// tidied, not empty, at most 120 characters. Anything else is a bad request. Pure.

export const CATEGORY_SLUG_MAX = 120;

export type CategoryProductsRequest =
  { readonly kind: "bad_request" } | { readonly kind: "category"; readonly slug: string };

export function readCategoryProductsRequest(params: URLSearchParams): CategoryProductsRequest {
  const names = [...params.keys()];
  if (names.length !== 1 || names[0] !== "category") return { kind: "bad_request" };
  const slug = tidyText(params.get("category") ?? "");
  if (!slug || slug.length > CATEGORY_SLUG_MAX) return { kind: "bad_request" };
  return { kind: "category", slug };
}
