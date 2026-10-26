// The URL map (spec 0003, adopted from the design handoff; products by slug).
// Every link in the app is built here, so a route changes in one place.
import {
  EMPTY_FILTERS,
  serializeListFilters,
  type ListFilters,
} from "@/features/catalog/list-filters";

const segment = (value: string) => encodeURIComponent(value);

const categoryPath = (category: string, sub: string | null) =>
  sub ? `/c/${segment(category)}/${segment(sub)}` : `/c/${segment(category)}`;

const withQuery = (path: string, query: string) => (query ? `${path}?${query}` : path);

// Filtered and searched lists carry their state in the address through one serializer, in one
// fixed order (spec 0010 AC-8).
const categoryPage = (
  category: string,
  sub: string | null,
  page = 1,
  filters: ListFilters = EMPTY_FILTERS,
) => withQuery(categoryPath(category, sub), serializeListFilters(filters, { page }));

const searchPage = (q: string, filters: ListFilters = EMPTY_FILTERS, page = 1) =>
  withQuery("/search", serializeListFilters(filters, { q, page }));

export const routes = {
  home: "/",
  categories: "/c",
  category: (category: string) => categoryPath(category, null),
  subcategory: (category: string, sub: string) => categoryPath(category, sub),
  /** A main (no `sub`) or sub page with its filters; page 1 is left out (spec 0008 AC-11). */
  categoryPage,
  /** "Load more": the next page, jumping to its first new card `p-<position>`. */
  categoryMore: (
    category: string,
    sub: string | null,
    page: number,
    position: number,
    filters: ListFilters = EMPTY_FILTERS,
  ) => `${categoryPage(category, sub, page, filters)}#p-${position}`,
  /** A product page; `variant` opens it on that size and colour (`?v=<id>`, spec 0009 AC-6). */
  product: (slug: string, opts?: { readonly variant?: string | null }) =>
    opts?.variant
      ? `/p/${segment(slug)}?v=${encodeURIComponent(opts.variant)}`
      : `/p/${segment(slug)}`,
  /** The search prompt, or a search for `query`. */
  search: (query?: string) => searchPage(query ?? ""),
  /** A search with its filters and page (spec 0010 AC-5); an empty `q` is the prompt. */
  searchPage,
  /** "Load more" on search: the next page, jumping to its first new card `p-<position>`. */
  searchMore: (q: string, filters: ListFilters, page: number, position: number) =>
    `${searchPage(q, filters, page)}#p-${position}`,
  /** The live count behind the filters screen (spec 0010 AC-12): a category or a search scope. */
  catalogCount: (
    scope:
      | { readonly kind: "category"; readonly main: string; readonly sub: string | null }
      | { readonly kind: "search"; readonly q: string },
    filters: ListFilters,
  ) => {
    const head = new URLSearchParams(
      scope.kind === "search"
        ? { q: scope.q }
        : { main: scope.main, ...(scope.sub === null ? {} : { sub: scope.sub }) },
    ).toString();
    const rest = serializeListFilters(filters);
    return `/api/catalog/count?${head}${rest ? `&${rest}` : ""}`;
  },
  cart: "/cart",
  checkout: "/checkout",
  checkoutDone: (number: string) => `/checkout/done/${segment(number)}`,
  order: (number: string) => `/orders/${segment(number)}`,
  orderTrack: "/orders/track",
  signIn: "/account/sign-in",
  accountOrders: "/account/orders",
  quickOrder: "/account/quick-order",
  drafts: "/account/drafts",
  privacy: "/policies/privacy",
  terms: "/policies/terms",
  returns: "/policies/returns",
  designSystem: "/design-system",
  admin: {
    home: "/admin",
    orders: "/admin/orders",
    /** The orders list page `page` (1 based); page 1 is the plain list. */
    ordersPage: (page: number) => (page > 1 ? `/admin/orders?page=${page}` : "/admin/orders"),
    order: (number: string) => `/admin/orders/${segment(number)}`,
    customers: "/admin/customers",
    reports: "/admin/reports",
    products: "/admin/products",
    /** The products list with its filters (spec 0006 AC-1); empty values and page 1 stay out. */
    productsList: (filters: {
      readonly q?: string | null;
      readonly categoryId?: string | null;
      readonly filter?: string | null;
      readonly page?: number;
    }) => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.filter && filters.filter !== "all") params.set("filter", filters.filter);
      if (filters.page && filters.page > 1) params.set("page", String(filters.page));
      const query = params.toString();
      return query ? `/admin/products?${query}` : "/admin/products";
    },
    productNew: "/admin/products/new",
    product: (id: string) => `/admin/products/${segment(id)}`,
    productImport: "/admin/products/import",
    categories: "/admin/categories",
    homepage: "/admin/homepage",
    settings: "/admin/settings",
    login: "/admin/login",
    mfa: "/admin/mfa",
  },
} as const;
