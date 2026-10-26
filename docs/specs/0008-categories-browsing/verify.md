# Verify: Categories and browsing · spec 0008 · updated 2026-10-22
_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Sign in, open `/admin/categories` with no categories → the empty card with one "+ قسم رئيسي" button; the note "القسم له مستويان فقط: رئيسي وفرعي." at the bottom → AC-1
- [x] "+ قسم رئيسي", name "ثريات", save → a card "ثريات · 0 منتج"; "+ قسم فرعي" on it, name "كريستال" → listed under a line, last among its siblings → AC-1, AC-2
- [x] Add a main named "LED", then another main named " led " → refused on the name field with "هذا الاسم مستخدم في نفس المستوى", focus on the field → AC-2
- [x] Add a main named "★★" → saved; its address is `/c/qism` (or `qism-2` …) → AC-2
- [x] Add a sub under a hidden main → the dialog shows "القسم الرئيسي مخفي، فلن يظهر هذا القسم في المتجر حتى يظهر الرئيسي." → AC-2
- [x] "تعديل" on "كريستال", rename to "كريستال فاخر" → name changes; `/c/<main>/<old slug>` still opens → AC-3
- [x] Import two mains with the spreadsheet (both `sort` 0), then ↓ on the first → they swap in one step; focus stays on the same ↓ button; ↑ on the first row and ↓ on the last are `aria-disabled` → AC-4
- [x] Open the categories page in two tabs, move a category to the top in one, press ↑ on it in the other → nothing changes and the stale tab refreshes to the current order → AC-4
- [x] Trash on a main with a sub, or a category holding one archived product → disabled, with "فيه منتجات أو أقسام فرعية" beside it; trash on an empty sub → confirm dialog naming it, then it is gone → AC-1, AC-5
- [x] Hide "ثريات" (edit, switch off) → "مخفي" badge on the main only; the subs keep their own flags; show it again → the subs that were shown are shown again → AC-6
- [x] With a product in "كريستال": hide "ثريات" → home leaves it out, `/c/<main>`, `/c/<main>/<sub>`, and `/p/<slug>` return 404; a cart line added before shows as not available with no link, and "إتمام الطلب" is refused → AC-7, AC-8
- [x] `/c/<sub slug>`, `/c/<other main>/<sub>`, `/c/does-not-exist` → 404 (status 404, not 200) → AC-8
- [x] Open a main with subs → breadcrumb "الرئيسية › main", one h1, the subline of navigation subs joined by "، ", chips "الكل" (current) then the subs, "M منتج", the grid, "تم عرض N من M منتج", the help card → AC-9
- [x] A product placed directly on a main shows on the main page with its shown subs' products; a hidden product and an archived one never show → AC-10
- [x] A category with in stock and out of stock products → in stock first, newest first inside each group → AC-10
- [x] A sub with 30 listed products → 24 cards; "عرض المزيد" goes to `?page=2#p-25` with 30 cards and focus on card 25's name; `?page=9` shows all 30 with no button; page 2 has `noindex, follow` and no canonical → AC-11
- [x] A card with photos, three specs, and two prices → first photo, up to three chips, "من ₪X"; "أضف للسلة" adds the cheapest sellable option and shows "تمت الإضافة" for 2 seconds → AC-12
- [x] An out of stock card → photo at 45%, black "غير متوفر" label, disabled "غير متوفر" button, muted "₪X" with no "من", WhatsApp named "اسأل عن توفره عبر واتساب: <name>" opening W4 → AC-12
- [ ] A shown category with no products → "لا توجد منتجات في هذا القسم بعد" and the WhatsApp W2 button, no count, chips stay; with the database stopped → the error card "تعذّر تحميل المنتجات" → AC-13
- [ ] Throttle the network on a category page → the title area, then six skeleton cards announced as "جارٍ تحميل المنتجات" → AC-13
- [ ] Open the menu → "الأقسام" heading with one link per main that has listed products; with the database stopped, every storefront page still renders with the menu minus the list → AC-14
- [x] `/c` → one card per navigation main, its count, its navigation subs as links; bottom bar tab "الأقسام" active on `/c` and every category page → AC-15
- [x] View source of a category page → title `<name> | S.K.F للإنارة`, its description (else the shop default), a canonical on page 1, BreadcrumbList JSON-LD with absolute URLs and `<` escaped → AC-16
- [ ] Product editor → no "new category" field; the selects mark hidden ones "(مخفي)"; choosing a hidden one shows "هذا القسم مخفي، فلن يظهر المنتج في المتجر."; "إدارة الأقسام" asks before leaving with unsaved changes; with no categories, a note with the link → AC-17
- [x] As a customer account, open `/admin/categories` → the dashboard redirect; call `createCategory` directly → `forbidden`, no row written → AC-18

## Value sourcing

- [x] Slug: add "LED" twice at different levels → `led`, then `led-2` → `createCategory` slug
- [x] Sort: add three subs → sorts 0, 1, 2; add a main after imported mains at `sort` 0 → it goes last → `createCategory` sort
- [ ] Parent: post `parentId` of a sub → `too_deep`; of a deleted main → `not_found` → `createCategory` parent
- [x] Description: save "   " → stored as null → name, description, visibility
- [x] Reorder: after one move, every sibling has a distinct sort `0..n-1` → `moveCategory` sorts
- [ ] Delete: a product saved into the category between the check and the delete → `not_empty` → `deleteCategory`
- [x] Admin count: one active, one hidden, one archived product → "· 2 منتج" → `listAdminCategories` count
- [x] Shown: hide only a sub → its main still shown, its page 404 → shown rule
- [x] Navigation count: main with 1 own product and a shown sub with 2 → "3 منتج" on `/c`; hide the sub → "1 منتج" → `listNavigation` count
- [x] Page M and N: 30 products, `?page=2` → "تم عرض 30 من 30"; `?page=abc` → page 1 → shown count
- [x] Card image: two photos with sorts 1 and 0 → the sort 0 one shows → card image
- [x] Card chips: specs with an empty second value → chips skip it → card chips
- [x] Card price: sellable 150 and 120, unavailable 50 → "من ₪120"; all unavailable → muted lowest live price → card price
- [x] Card variant: two sellable at the same price, the default second by sort → the default is added → card variant
- [x] W3 and W4: the link in the WhatsApp text is `NEXT_PUBLIC_SITE_URL` + `/p/<slug>` → card WhatsApp text

## Commands

- [x] `pnpm exec vitest run src/features/catalog src/features/cart src/lib` → all pass → AC-19
- [x] `pnpm exec vitest run src/features/catalog/server/storefront.db.test.ts src/features/catalog/server/categories.db.test.ts src/features/checkout/server/place-order.db.test.ts` (local Supabase) → all pass → AC-4, AC-4a, AC-5, AC-6, AC-7, AC-19
- [x] `pnpm exec playwright test e2e/categories.spec.ts --project=phone --workers=1` → passes → AC-19

## Acceptance-criteria coverage

- AC-1 manual 1, 2, 9 · AC-2 manual 2 to 5 · AC-3 manual 6 · AC-4 manual 7, 8 · AC-4a value sourcing (reorder, delete) · AC-5 manual 9 · AC-6 manual 10 · AC-7 manual 11 · AC-8 manual 11, 12 · AC-9 manual 13 · AC-10 manual 14, 15 · AC-11 manual 16 · AC-12 manual 17, 18 · AC-13 manual 19, 20 · AC-14 manual 21 · AC-15 manual 22 · AC-16 manual 23 · AC-17 manual 24 · AC-18 manual 25 · AC-19 commands
