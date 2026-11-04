// The URL map (spec 0003, adopted from the design handoff; products by slug).
// Every link in the app is built here, so a route changes in one place.
import {
  EMPTY_FILTERS,
  serializeListFilters,
  type ListFilters,
} from "@/features/catalog/list-filters";
import { orderFiltersToParams, type OrderFilters } from "@/features/orders/admin-filters";

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
  /** The lookup with its number field filled (spec 0015 AC-7). */
  orderTrackWith: (number: string) => `/orders/track?number=${encodeURIComponent(number)}`,
  signIn: "/account/sign-in",
  /** Sign in on a given form, carrying where to go afterwards; never an email (spec 0017 AC-1). */
  signInWith: (opts: {
    readonly tab?: "login" | "register" | "reset";
    readonly next?: string | null;
    readonly error?: "link_expired";
  }) => {
    const params = new URLSearchParams();
    if (opts.tab && opts.tab !== "login") params.set("tab", opts.tab);
    if (opts.next) params.set("next", opts.next);
    if (opts.error) params.set("error", opts.error);
    return withQuery("/account/sign-in", params.toString());
  },
  account: "/account",
  /** The account page with a one time message (spec 0017 AC-8). */
  accountWith: (notice: "password_set") => `/account?notice=${notice}`,
  accountResetPassword: "/account/reset-password",
  accountOrders: "/account/orders",
  /** "Load more" on My Orders (spec 0018 AC-5): page 1 is left out; jumps to card `o-<position>`. */
  accountOrdersMore: (page: number, position: number) =>
    `${withQuery("/account/orders", page > 1 ? `page=${page}` : "")}#o-${position}`,
  quickOrder: "/account/quick-order",
  /** A saved draft open on the quick order page (spec 0020 AC-4). */
  quickOrderDraft: (id: string) => `/account/quick-order?draft=${encodeURIComponent(id)}`,
  drafts: "/account/drafts",
  /** The drafts list with a one time message (spec 0020 AC-15). */
  draftsWith: (notice: "deleted") => `/account/drafts?notice=${notice}`,
  privacy: "/policies/privacy",
  terms: "/policies/terms",
  returns: "/policies/returns",
  designSystem: "/design-system",
  /** Route handlers outside the catalog's public reads. */
  api: {
    /** The quick order product search (spec 0020 AC-7). */
    quickOrderProducts: (q: string) => `/api/quick-order/products?q=${encodeURIComponent(q)}`,
  },
  /** Outside locale routing, like the dashboard (spec 0017 AC-8). */
  auth: { confirm: "/auth/confirm" },
  admin: {
    home: "/admin",
    orders: "/admin/orders",
    /** The orders list with its filters on page `page` (spec 0014 AC-12); page 1 is left out. */
    ordersWith: (filters: OrderFilters, page = 1) =>
      withQuery("/admin/orders", orderFiltersToParams(filters, page).toString()),
    order: (number: string) => `/admin/orders/${segment(number)}`,
    customers: "/admin/customers",
    /** The customers list on page `page` (spec 0019 AC-2); page 1 is left out. */
    customersPage: (page: number) => withQuery("/admin/customers", page > 1 ? `page=${page}` : ""),
    /** The customers list with a one time notice (spec 0019 AC-11). */
    customersWith: (opts: { readonly notice: "removed" }) =>
      `/admin/customers?notice=${opts.notice}`,
    customer: (id: string) => `/admin/customers/${segment(id)}`,
    /** "Load more" on a customer's orders (spec 0019 AC-6): page 1 left out; jumps to `o-<position>`. */
    customerOrdersMore: (id: string, page: number, position: number) =>
      `${withQuery(`/admin/customers/${segment(id)}`, page > 1 ? `page=${page}` : "")}#o-${position}`,
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
