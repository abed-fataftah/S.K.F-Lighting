# 0008. Categories and browsing

**Date**: 2026-10-21
**Status**: In Progress

## Summary

This spec adds the categories page in the dashboard (add, rename, reorder, hide, and delete an empty category) and the customer pages that browse them: `/c` lists the main categories, and `/c/<main>` and `/c/<main>/<sub>` show a category's products as cards, 24 at a time. Hiding a category hides it completely: its page and its products' pages return not found, and its products cannot be ordered, because the shop's one "can be sold" rule now also checks that the category is visible. No new tables or columns are needed. Filters stay with feature 11; the card gains the add to cart and WhatsApp buttons from the design.

## Requirements

**User stories**:

- As the owner, I want to add, rename, reorder, hide, and delete categories in one place, so the shop's sections match what I sell.
- As the owner, I want hiding a category to take it and its products off the shop completely, so customers never see a section I am not ready to sell.
- As a customer on a phone, I want to open a category and see its products with photo, name, code, price, and availability, so I can find what I need and add it to my cart quickly.
- As a customer, I want a clear message when a category is empty or a product is out of stock, and a WhatsApp way to ask, so I am never stuck.

All storefront reads and dashboard actions live under `src/features/catalog/server/` and import `server-only`. Every dashboard action calls `requireAdmin()` first. Category names and descriptions are tidied with the spec 0005 helpers (`tidiedText` in `src/lib/text-schemas.ts`), parsed with one shared Zod schema in `src/features/catalog/schemas.ts` on the server too. Every number and price on screen goes through `src/lib/format.ts` and `src/lib/money.ts`; every link through `routes` in `src/lib/routes.ts`; every string through `ar.json` (dashboard words in an `Admin…` namespace, storefront words in `Catalog` and a new `Categories` namespace).

**Acceptance criteria**:

- **AC-1**: Categories page. `/admin/categories` (design `pages/admin-categories.md`) shows one card per main category in category order (below), each with its name, `· N منتج` (products not `archived` in it and in its subs), a "مخفي" badge when its own `is_visible` is false, and the buttons ↑, ↓, "تعديل", "+ قسم فرعي", and a trash button. Under a 1px line it lists its subs in category order with name, count (products not `archived`), a "مخفي" badge when the sub's own `is_visible` is false, ↑, ↓, "تعديل", and trash. The trash button is disabled (`aria-disabled`, with the visible reason "فيه منتجات أو أقسام فرعية" as its description) when the category has any product in any status or, for a main, any sub. The page header has "+ قسم رئيسي"; the note "القسم له مستويان فقط: رئيسي وفرعي." sits at the bottom. With no categories it shows the empty card with one "+ قسم رئيسي" button; a failed or slow read (3 seconds) shows the error card with a retry button; loading shows skeleton cards. Every button names its category in `aria-label` (for example "نقل لأعلى: ثريات").
- **AC-2**: Add. "+ قسم رئيسي" and "+ قسم فرعي" open one category dialog with name (required, 2 to 60 characters after tidying), description (optional, at most 500 characters after tidying), and a "ظاهر في المتجر" switch (on by default). Saving creates the category with `parent_id` null (main) or the chosen main's id (sub), `slug = nextFreeSlug(slugify(name), taken)` (spec 0004; when `slugify` returns an empty string the base is `qism`), and `sort` one above the highest sort among its siblings (0 when it has none). A parent that is itself a sub gives `too_deep`; a parent that no longer exists gives `not_found`; a tidied name already used by a sibling (compared as `lower(btrim(name))`, so "LED" and "led" clash) gives `name_taken` on the name field ("هذا الاسم مستخدم في نفس المستوى"). When the chosen main is hidden, the dialog shows the note "القسم الرئيسي مخفي، فلن يظهر هذا القسم في المتجر حتى يظهر الرئيسي." The insert lives in one shared `insertCategory` helper in `server/categories.ts`, which the import's find or create (spec 0007) also uses, so imported categories get the same slug fallback and go last among their siblings; the import's name match uses the same `lower(btrim(name))` comparison.
- **AC-3**: Edit. "تعديل" opens the same dialog filled with the category's name, description, and visibility. Saving updates only those three fields; `slug`, `parent_id`, and `sort` never change on edit, so `/c/...` links keep working after a rename. Errors: `name_taken` (a sibling other than itself has the tidied name), `not_found`.
- **AC-4**: Reorder. ↑ and ↓ swap a category with its neighbour among its siblings (mains among mains, subs among the subs of the same main). Category order everywhere is `sort`, then `name`, then `id`. The action reads all siblings in that order inside one transaction, renumbers them `0..n-1`, swaps the two, and writes the new sorts, so equal sorts left by the import (spec 0007, `sort` 0) still move one step. ↑ on the first and ↓ on the last are disabled (`aria-disabled`, not removed). After the move, focus stays on the same button of the moved category. A call from a stale page with no neighbour returns `at_edge`, changes nothing, and the page quietly refreshes to the current order.
- **AC-4a**: Concurrent edits, without a migration. `createCategory`, `updateCategory`, and `moveCategory` run in one transaction that first locks the sibling rows (`select … for update` on the categories with the same `parent_id`, and on the parent row for a sub), so the name check, `max(sort) + 1`, and the renumbering cannot race. A slug unique violation (`23505`) on create retries once with the next free slug, then returns `failed`. A foreign key violation (`23503`) on delete, from a product saved meanwhile, returns `not_empty`.
- **AC-5**: Delete. The trash button opens a confirm dialog naming the category. It deletes only a category with no products in any status (including `hidden` and `archived`) and, for a main, no subs; otherwise it gives `not_empty` with "لا يمكن حذف قسم فيه منتجات أو أقسام فرعية." and nothing changes. The foreign keys (`on delete restrict`) are the backstop.
- **AC-6**: Shown categories. A main is **shown** when its `is_visible` is true; a sub is shown when its own `is_visible` and its main's `is_visible` are both true. Hiding a main never writes its subs' flags, so showing it again brings back exactly the subs that were showing before.
- **AC-7**: Hidden means hidden. The one sellable rule (spec 0002, `src/features/catalog/sellable.ts` and its SQL twin in `queries.ts`) becomes: product `active` and `is_available`, variant `is_available` and `archived_at is null`, **and the product's category shown** (AC-6). "Shown" is one shared SQL fragment, `c.is_visible and (c.parent_id is null or parent.is_visible)` over the product's category `c` left joined to its parent, used by every storefront read. The touch points are: the list SQL in `src/features/catalog/server/queries.ts` (home grid, category lists, navigation, and `getProductBySlug`); `src/features/cart/server/cart-rows.ts`, which joins the category and its parent and returns `categoryShown`; and `src/features/cart/cart-view.ts` with `sellable.ts`, where `SellableProduct` gains `categoryShown` and `isSellable` and `pickVariantToAdd` check it. `placeOrder` and `addToCart` read through `readCartRows` and `buildCartView`, so they need no edit of their own. Result: the home grid and category lists leave those products out, `/p/<slug>` of a product whose category is not shown returns the not found page, a cart line for it shows as not available (the existing not sellable line state, its name shown without a link because the product page is gone), and `placeOrder` refuses it like any not sellable line. The dashboard lists and editor are unchanged: the third copy of the rule in `admin-queries.ts` stays category blind on purpose (the admin badge describes the product itself), and the parity test covers only the storefront code and SQL pair.
- **AC-8**: Category page address. `/c/<main>` opens a shown main by its slug, and `/c/<main>/<sub>` a shown sub whose parent is that main. An unknown slug, a category that is not shown, a sub whose parent is not `<main>`, or a sub's slug used at `/c/<slug>` returns the shop's not found page (404). Slugs match exactly after `decodeURIComponent` (they are already lowercase from `slugify`); no case folding, no redirects.
- **AC-9**: Category page. Per design `pages/category.md`, without the filter parts (filter button, applied chips, filters screen): breadcrumb (`الرئيسية` › main, plus › sub on a sub page; links 44 high, current item not a link, `aria-current="page"`), one `h1` with the category name, a subline listing the main's navigation subs (AC-14) joined with "، ", a row of sub chips (`الكل` first, then the navigation subs, plus the current sub on a sub page even when it is outside navigation) where each chip is a link (`الكل` to `/c/<main>`, a sub to `/c/<main>/<sub>`) and the current one is marked `aria-current="page"` and drawn selected, the count `M منتج` in a `role="status"` region, the product grid (two columns), "تم عرض N من M منتج" and the "عرض المزيد" button, and the help card (W2). A main with no navigation subs shows no subline and no chip row.
- **AC-10**: Which products, in what order. A main page lists the **listed** products placed directly on the main (the editor allows a product with no sub) and those of its shown subs; a sub page lists the sub's own. The main's `M`, on its page and on `/c`, counts both. A listed product is `active` (any availability) in a shown category; `hidden` and `archived` products never appear. Order: products with at least one sellable variant first, then the rest; inside each group newest first (`created_at desc, id desc`). This changes spec 0002's plain newest first order for category lists only.
- **AC-11**: Paging. 24 products per step. `?page=N` (read with `parsePage`) is clamped to `max(1, ceil(M / 24))` **before** any limit is built, then the page shows the first `N × 24` products in that order (one `limit`, deliberately not `pageWindow`/`splitPage`, since earlier steps stay on screen). Cards carry `id="p-<position>"`, positions counted from 1. "عرض المزيد" is a link to `?page=N+1` with the fragment `#p-<N × 24 + 1>`; a small client component reads `location.hash` after render and moves focus to that card's name link (no match, no move). A page beyond the last behaves as the last (everything shown). When everything is shown the button is gone and the line reads "تم عرض M من M منتج". Pages 2 and up carry `noindex, follow` and no canonical tag. Because in stock products come first, a product going out of stock between two loads can shift a card by one position; this is accepted (see Consequences).
- **AC-12**: Product card (design `design.md` section 7, the same card on the home grid and the category page). It shows: the first image by `sort, id` from `product_media` (`kind = image`) through the existing image loader, else `ImagePlaceholder`; the name as the link to `/p/<slug>`; `الكود: <code>` (`dir="ltr"`); up to three spec chips, the `value` of the first three `specs` rows in stored order whose tidied value is not empty (fewer rows, fewer chips; a long value is cut off with CSS, the full text stays in the accessible name); the list price (spec 0002: the lowest price among sellable variants, shown `من ₪X` when sellable prices differ); and "متوفر" when it has a sellable variant, else "غير متوفر". Below: the yellow "أضف للسلة" button, which adds one unit of the **card variant** through the existing `addToCart` action: the sellable variant with the lowest price, on a tie the default, then the lowest `sort`, so the cart line costs what the card shows (this replaces O-11's "first available option" for cards; the product page keeps `pickVariantToAdd`). It shows "تمت الإضافة" for 2 seconds in an `aria-live="polite"` region; a `not_sellable`, `cart_full`, or `invalid` result shows the existing cart messages (as `add-to-cart.tsx` maps them). Next to it, the 44×44 green WhatsApp button opens W3 with the name, code, and the product's absolute link (`NEXT_PUBLIC_SITE_URL` + `routes.product(slug)`; the size and colour parts of the template left empty). Out of stock: image at 45% opacity, the black "غير متوفر" label at the inline start top corner, a disabled "غير متوفر" button, and the price muted: the lowest price over the product's variants with `archived_at is null`, shown `₪X` with no "من"; a product with no such variant shows no price. The WhatsApp button stays, opens **W4** (availability) with the name, code, and link, and its accessible name is "اسأل عن توفره عبر واتساب: <name>" (design `pages/product.md`).
- **AC-13**: Empty, error, loading. A shown category with no listed products shows the empty card ("لا توجد منتجات في هذا القسم بعد", a line, and a green "اسألنا عبر واتساب" button with W2); no count, chips stay. A failed or slow read (3 seconds, `withTimeLimit`) shows the page error card ("تعذّر تحميل المنتجات", "إعادة المحاولة" reloads the page, "اطلب عبر واتساب"), and logs say what failed, never values. Loading (`loading.tsx`) shows the title area and six skeleton cards in `role="status"` with the hidden text "جارٍ تحميل المنتجات".
- **AC-14**: Navigation. A category is in **navigation** when it is shown and has at least one listed product (a main counts its shown subs' listed products too). Navigation drives: the menu sheet (one 48px link per navigation main, in category order, with a "الأقسام" heading, replacing nothing else in the sheet), `/c`, the sub chips, and the subline. A shown category outside navigation still opens by its address and shows the empty state (AC-13). The menu sheet is a client component, so a server parent in the shell reads `listNavigation` and passes it down as props. That read runs on every storefront page: it is wrapped in React `cache()` (shared with `/c` in the same request) and `withTimeLimit` at 1.5 seconds, like the footer; a failure or timeout renders the sheet without the category list and logs what failed, never values, so the shell never breaks.
- **AC-15**: `/c` page. `h1` "الأقسام", then one card per navigation main in category order: the main's name as a link to `/c/<main>`, `M منتج` (its listed products, subs included), and its navigation subs as 44 high links to `/c/<main>/<sub>`. No navigation mains: the empty card with the W2 WhatsApp button. A failed read shows the error card. Bottom bar tab "الأقسام" is active on `/c` and every category page (already true in `activeTab`).
- **AC-16**: Search engines. A category page's title is `<name> | S.K.F lighting`, its description the category's `description`, else `Metadata.description` from `ar.json`; page 1 has a canonical to its own absolute address (pages 2 and up: none, per AC-11); it carries BreadcrumbList JSON-LD (الرئيسية, main, and sub when present, absolute URLs from `NEXT_PUBLIC_SITE_URL`), serialized with `<` escaped as `<`. `/c` has the title `الأقسام | S.K.F lighting`, the default description, and a canonical. The site map and share images stay with feature 28.
- **AC-17**: Product editor. The editor's "new main category name" field (spec 0006 AC-18, "until feature 9 ships") is removed; the main and sub selects stay, list every category (a hidden one marked "(مخفي)"), and a "إدارة الأقسام" link opens `/admin/categories` in the same tab, behind the unsaved changes guard. With no categories at all, the editor shows a short note with that link in place of the selects, and save gives `category_required`. Choosing a category that is not shown (AC-6) shows the warning "هذا القسم مخفي، فلن يظهر المنتج في المتجر." under the selects; saving is still allowed. A category deleted in another tab after the editor loaded gives the existing `category_required` on save. The import (spec 0007) keeps creating categories by name, unchanged.
- **AC-18**: Access. Every category action and the categories page run `requireAdmin()` (role `admin` and `aal2`), and each write calls `getVerifiedUser()` first. A signed out visitor or a non admin opening `/admin/categories` gets the dashboard's existing redirect; a direct action call returns `{ ok: false, error: "forbidden" }` and changes nothing. The storefront pages are public and read only.
- **AC-19**: Tests. Vitest beside the source for every pure rule (shown, navigation, category order, the reorder plan, the product list order, the card view: chips, list price, stock word, add variant); database tests for the actions (add, the slug clash, `name_taken`, `too_deep`, reorder with equal sorts, delete blocked, hide a main keeps sub flags) and for the sellable change (a hidden category's product is left out of the home read, its product page read returns null, and `placeOrder` refuses it); one Playwright flow on a phone sized RTL screen: the owner adds a main and a sub, renames one, reorders, hides and shows again; a customer opens `/c`, the main, and the sub, sees an out of stock card, loads more, adds a product from a card; a hidden category's page and product page give 404; axe passes on `/admin/categories`, `/c`, and a category page.

## Decision

**Chosen option**: Option 1: Server rendered category pages on the existing tables, with "category shown" folded into the one sellable rule

Category pages render on the server from Drizzle reads, paging is a plain link (`?page=N`), dashboard edits are small Server Actions on the existing `categories` columns, and a hidden category takes its products out of every storefront read and out of ordering through the shared sellable rule.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) for server rendering and the small client card buttons · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`) for one product card shared by home and category · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) for the dialog, switch, and confirm · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) for the list and reorder queries · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) for AC-19

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

### Data model sketch

No migration. This feature uses the tables of spec 0002 as they are.

| Table | Columns used | Notes |
|---|---|---|
| `categories` | `id`, `parent_id` (null = main, fixed at create), `name`, `slug` (set once at create), `description`, `sort`, `is_visible`, `created_at`, `updated_at` | Self reference on delete restrict; two levels enforced in the add action (`too_deep`); sibling name uniqueness enforced in the actions, not the database (the import's find or create by name relies on the same rule) |
| `products` | `id`, `category_id`, `slug`, `name`, `code`, `specs`, `status`, `is_available`, `created_at` | `products_category_id_idx` serves the category lists |
| `product_variants` | `product_id`, `price`, `is_available`, `archived_at`, `is_default`, `sort` | List price and the add variant |
| `product_media` | `product_id`, `kind`, `storage_key`, `sort`, `id` | First image for the card |

Relationships: category 1:N subs (restrict), category 1:N products (restrict), product 1:N variants and media (cascade). All derived values (shown, navigation, counts, list price, stock) are computed at read time, never stored.

### State transitions

A category has one switch, `is_visible`: `visible ⇄ hidden`, both ways from the edit dialog (AC-3). Its storefront state is derived: **shown** (AC-6), then **in navigation** (AC-14). Delete is only possible from either state when empty (AC-5).

### API surface

| Name | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `listAdminCategories` | query | none | `{ mains: { id, name, isVisible, productCount, canDelete, subs: { id, name, isVisible, productCount, canDelete }[] }[] }` in category order | admin (page) | none |
| `createCategory` | Server Action | `parentId?: uuid`, `name`, `description?`, `isVisible` | `{ id, slug }` | admin | `name_taken`, `too_deep`, `not_found`, `failed` (slug clash after one retry), field errors, `forbidden` |
| `updateCategory` | Server Action | `id`, `name`, `description?`, `isVisible` | `{ id }` | admin | `name_taken`, `not_found`, field errors, `forbidden` |
| `moveCategory` | Server Action | `id`, `direction: "up" \| "down"` | `{ id }` | admin | `not_found`, `at_edge` (no neighbour; nothing changes), `forbidden` |
| `deleteCategory` | Server Action | `id` | `{ id }` | admin | `not_empty`, `not_found`, `forbidden` |
| `listNavigation` | query | none | `{ mains: { slug, name, productCount, subs: { slug, name, productCount }[] }[] }` (navigation only, category order) | public | read failure → caller shows error card |
| `getCategoryPage` | query | `mainSlug`, `subSlug?`, `page` | `{ main: { slug, name, description }, sub?: { slug, name, description }, navSubs, total, products: CardProduct[] }` or `null` (AC-8) | public | `null` → 404 |
| `listHomeProducts` (changed) | query | none | `CardProduct[]`, sellable only, newest first | public | as today |
| `CardProduct` (shared view) | type | | `{ slug, name, code, imageKey, chips: string[], listPrice, pricesDiffer, inStock, addVariantId }` (`addVariantId` null when out of stock; `listPrice` null when no live variant) | | |

Card reads (home and category) use three queries per page: one for the products in order with `limit`, one `inArray` read of their live variants (`price`, `is_available`, `archived_at`, `is_default`, `sort`), and one `inArray` read of their first image; `CardProduct` is built from these by a pure function. The home grid keeps its limit of 24 and its sellable only, newest first rule.

The categories page and dialog call the actions with `FormData` parsed by the shared schema; each action returns the typed result `{ ok: true, data } | { ok: false, error }` and calls `revalidatePath` for `/admin/categories`. Storefront pages are rendered per request (no caching; Hyperdrive caching is off per spec 0002).

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| `createCategory` | `slug` | `nextFreeSlug(slugify(name) or "qism", slugs starting with that base)` (spec 0004) |
| `createCategory` | `sort` | `max(sort) + 1` over siblings with the same `parent_id` (null for mains), 0 when none |
| `createCategory` | `parent_id` | input `parentId`, checked to be a main |
| `createCategory`, `updateCategory` | `name`, `description`, `is_visible` | inputs, tidied per spec 0005; empty description stored as null |
| `moveCategory` | new `sort` of every sibling | siblings read in category order inside the transaction, renumbered, two swapped |
| `deleteCategory` | allowed or `not_empty` | `exists` product with `category_id = id` (any status) or `exists` category with `parent_id = id`; a `23503` from a concurrent product save also maps to `not_empty` |
| `listAdminCategories` | `productCount` | count of products with `status <> 'archived'` in the category, plus its subs' for a main |
| `listAdminCategories` | `canDelete` | no product in any status on the category and, for a main, no sub (same rule as `deleteCategory`) |
| all storefront reads | category shown | AC-6 from `categories.is_visible` of the category and its parent |
| `listNavigation` | `productCount`, membership | count of listed products (AC-10) per category, a main adding its shown subs' |
| `getCategoryPage` | `total` (M) | count of listed products for the page (main plus shown subs, or the sub) |
| `getCategoryPage` | shown count (N) | `min(page × 24, total)`, `page` from `parsePage(searchParams.page)` clamped to `max(1, ceil(total / 24))` before the limit is built |
| `getCategoryPage` | product order | has a sellable variant desc, `created_at desc`, `id desc` |
| card | `imageKey` | first `product_media.storage_key` with `kind = 'image'` by `sort, id` |
| card | `chips` | the first three non empty tidied `specs[].value` in stored order |
| card | `listPrice`, `pricesDiffer` | `min(price)` and `min <> max` over sellable variants (spec 0002); out of stock: `min(price)` over variants with `archived_at is null`, `pricesDiffer` false; none: null |
| card | `inStock`, `addVariantId` | a sellable variant exists; the card variant: sellable, lowest `price`, then `is_default`, then lowest `sort` |
| card | W3 / W4 text | the design W3 (in stock) or W4 (out of stock) template in `ar.json` with name, code, `NEXT_PUBLIC_SITE_URL` + `routes.product(slug)`; size and colour parts empty |
| category page | subline, chips | `navSubs` from the navigation rule (AC-14); chips add the current sub when outside navigation |
| category page | title, description, canonical, JSON-LD | `name`, `description` else `Metadata.description`, `NEXT_PUBLIC_SITE_URL` + `routes.category`/`routes.subcategory` |
| menu sheet, `/c` | the list | `listNavigation` |

### Key invariants

- Two levels at most: a category with a parent never has children (checked in `createCategory`; parents never change).
- Sibling names are unique as `lower(btrim(name))` (checked in create and update under the sibling lock, AC-4a).
- A category's `slug` never changes after create.
- A product the storefront shows or sells is in a shown category (one sellable rule, in code and in SQL, kept in step by a unit test that runs both on the same table of cases).
- A category with products or subs cannot be deleted.
- Category order is always `sort, name, id`; reorder never leaves two siblings at the same sort.

### Security model

The owner (role `admin` at `aal2`) is the only one who reads `/admin/categories` and calls the category actions; each action runs `requireAdmin()` and writes call `getVerifiedUser()` first (`AGENTS.md`, Auth). The storefront pages are public reads through Drizzle on the server; the browser never queries the database, and hidden categories and their products never reach a public response. No personal data is involved. RLS stays on every table with no grants to `anon` or `authenticated` (unchanged). Category actions are owner only behind the admin session, so they need no extra rate limit; the public pages are plain reads with no write path.

### Configuration required

None new. Uses `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_WHATSAPP_NUMBER` (spec 0003).

### Critical test scenarios

- Happy path: the owner adds "ثريات" and its sub "كريستال", gives a product that sub, and a customer finds it from the menu, `/c`, and both category pages, then adds it from the card, verifies **AC-2**, **AC-9**, **AC-10**, **AC-12**, **AC-14**, **AC-15**
- Hidden: hiding "ثريات" makes `/c/<main>`, `/c/<main>/<sub>`, and the product page return 404, removes it from the menu and home, and `placeOrder` refuses a cart line added before; showing it again brings the sub back without touching the sub's flag, verifies **AC-6**, **AC-7**, **AC-8**
- Reorder after import: two mains made by the import (both `sort` 0) swap with one ↓ tap, verifies **AC-4**
- Delete blocked: deleting a main with one archived product gives `not_empty` and changes nothing, verifies **AC-5**
- Paging: 30 listed products show 24, then `?page=2` shows 30 with focus on card 25, and `?page=9` shows all 30, verifies **AC-11**
- Rename keeps links: renaming a category keeps its old `/c/<slug>` working, verifies **AC-3**
- Auth/permission: a signed in customer calling `createCategory` gets `forbidden` and no row is written, verifies **AC-18**

## Build plan

Tracer Bullet: first one real category travels dashboard → storefront page → card → cart, then each part thickens end to end.

1. **Pure rules.** In `src/features/catalog/`: `category-rules.ts` (shown, navigation from counts, category order, `planMove` for reorder, slug base fallback), the category Zod schema in `schemas.ts`, the `CardProduct` view builder (chips, list price, muted price, stock word, card variant), and the sellable rule gaining `categoryShown` in `sellable.ts` with its SQL twin (the shared "shown" fragment); Vitest tables for each, plus the code and SQL parity test. Satisfies **AC-4**, **AC-6**, **AC-7**, **AC-10**, **AC-12**, **AC-14**
2. **Thin thread: one category end to end.** The shared `insertCategory` helper (import switched to it), `createCategory` with the sibling lock, and `listAdminCategories`; `/admin/categories` with the add dialog (mains and subs); `getCategoryPage` for a main and a sub (first page only, no paging yet); `/c/[category]` and `/c/[category]/[sub]` with breadcrumb, title, chips, count, and the grid using the existing card; 404 rules; the sellable change in `queries.ts` (home grid, `getProductBySlug`), `cart-rows.ts`, and `cart-view.ts`, with DB tests through `placeOrder` and `addToCart`. Satisfies **AC-1**, **AC-2**, **AC-4a**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-18**
3. **The card.** The three query card read, real photo, spec chips, `من ₪X`, stock word, out of stock look with the muted price, the add button (card variant and `addToCart`), and the W3 or W4 WhatsApp button; the same card on home. Satisfies **AC-12**
4. **Dashboard thickens.** `updateCategory` (edit dialog, hidden parent note), `moveCategory` (↑ ↓ with focus kept, `at_edge` refresh), `deleteCategory` (confirm, `canDelete`, `not_empty` including the `23503` map), badges, empty, error, and loading states; AC-17 editor change (remove the inline field, mark hidden, the hidden warning, add the link, no category note) and update the spec 0004 and 0006 e2e flows that create a category inline to add it on `/admin/categories` first. Satisfies **AC-1**, **AC-3**, **AC-4**, **AC-4a**, **AC-5**, **AC-17**
5. **Storefront thickens.** `listNavigation` with `cache()` and the 1.5 second limit, the server parent feeding the menu sheet, `/c`, the subline, paging with `?page=N`, the early clamp, and the focus jump component, the help card, empty, error, and loading states, and the search engine metadata and escaped JSON-LD. Satisfies **AC-9**, **AC-11**, **AC-13**, **AC-14**, **AC-15**, **AC-16**
6. **Finish.** The AC-19 Playwright phone flow and axe on the three pages; strings checked by the language and design rule tests. Satisfies **AC-19**

## Consequences

**Positive**:
- No migration and no new infrastructure; the feature reuses the tables, card, cart action, paging helper, and slug rules already in the repo.
- Hiding a category means one thing everywhere, enforced by the same rule that guards ordering, so a hidden section can never leak into a list, a link, or an order.
- Links survive renames, and paged pages work without JavaScript and can be shared.

**Negative / tradeoffs**:
- The sellable rule now needs the category (and its parent) on every storefront read and in `placeOrder`: one more join in those queries, and four call sites to change together. A missed site would let a hidden product slip through; the parity test and the DB tests guard this.
- After a rename, the address still shows the old name. Fixing that later needs a slug history table with redirects.
- "عرض المزيد" reloads the page instead of appending in place, a small step away from the design's interaction; the jump and focus to the first new card keep the place.
- Counting listed products for navigation runs on every storefront page that shows the menu. At this shop's size (hundreds of products) it is cheap; if it is ever measured as slow, cache it then.
- In stock first ordering can shift a card by one position between two `?page` loads when stock changes in between, so the focus jump may land one card off. Rare at this size; plain newest first would avoid it, at the cost of out of stock cards mixed in.
- Category writes take a row lock on their siblings; harmless for one owner, but it is the reason no unique index (and no migration) is needed.
- Removing the editor's inline category field means the owner must make a category before the first product; the editor's note and link cover it.

**Neutral**:
- Category lists put in stock products first, which deliberately differs from spec 0002's plain newest first order (only for category lists; home stays sellable only, newest first).
- The categories page has no version check: the last write wins, which is fine for one owner making small edits.
- Feature 11 later adds filters to this page; feature 25 adds the Home circles (subtitle and photo columns) and reuses `listNavigation`; feature 28 adds the site map.

## Follow-up

- [ ] Design open items settled here, for the handoff: O-10 page size is 24 for category lists; O-23 the edit dialog has name, description, and the visible switch (subtitle and photo belong to feature 25); the `/c` page design is new (not on the boards), so a design pass is worth doing when the desktop layouts (O-1) are drawn.
- [ ] Owner review of wording written here for states the boards do not show (O-13): the category empty state, `name_taken`, `not_empty`, the editor's no category note.
- [ ] Spec 0006 AC-18's inline category field is retired by AC-17; spec 0004's happy path test changes with it. `/sync` may want to note this against those specs.
