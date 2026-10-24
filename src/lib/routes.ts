// The URL map (spec 0003, adopted from the design handoff; products by slug).
// Every link in the app is built here, so a route changes in one place.
const segment = (value: string) => encodeURIComponent(value);

const categoryPath = (category: string, sub: string | null) =>
  sub ? `/c/${segment(category)}/${segment(sub)}` : `/c/${segment(category)}`;

const categoryPage = (category: string, sub: string | null, page = 1) =>
  page > 1 ? `${categoryPath(category, sub)}?page=${page}` : categoryPath(category, sub);

export const routes = {
  home: "/",
  categories: "/c",
  category: (category: string) => categoryPath(category, null),
  subcategory: (category: string, sub: string) => categoryPath(category, sub),
  /** A main (no `sub`) or sub page; page 1 is the plain address (spec 0008 AC-11). */
  categoryPage,
  /** "Load more": the next page, jumping to its first new card `p-<position>`. */
  categoryMore: (category: string, sub: string | null, page: number, position: number) =>
    `${categoryPage(category, sub, page)}#p-${position}`,
  /** A product page; `variant` opens it on that size and colour (`?v=<id>`, spec 0009 AC-6). */
  product: (slug: string, opts?: { readonly variant?: string | null }) =>
    opts?.variant
      ? `/p/${segment(slug)}?v=${encodeURIComponent(opts.variant)}`
      : `/p/${segment(slug)}`,
  search: (query?: string) => (query ? `/search?q=${encodeURIComponent(query)}` : "/search"),
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
