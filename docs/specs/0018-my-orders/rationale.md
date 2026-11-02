# 0018. My Orders page: rationale

The build spec is [index.md](index.md). This file is the decision record.

## Context

Spec 0017 ties each order placed while signed in to the account (`orders.placed_by_user_id`) and lets the owner of an order open it without a lookup. What is missing is a place to see those orders together. The scope's done line for feature 19 asks that a signed in user sees only their own orders, each with status and what is still owed, and can open any one. A page design exists (`docs/design/pages/my-orders.md`) with the card layout and copy, but it shows only the total, leaves the page size open (O-10), and does not say whether "N منتجات" counts lines or units.

Three forces shape the open choices. First, money is not recorded yet: Payments (feature 24) is two slices away, so `amount_paid` is 0 on every order until then, and anything about the balance shows the same number as the total. Second, two kinds of user share this page: a regular customer with a handful of orders, and an electrician who may send dozens of long orders (a 30 line order is a stated target in feature 21). Third, the storefront already has one paging pattern (the category and search pages: `?page=N`, a count line, and "عرض المزيد"), and the design system says lists use "load more", never numbered pages.

Without a decision, the build would invent how a partly paid or cancelled order reads, how many orders appear, and what the item number means, and each of those is visible to every customer.

## Options considered

### Remaining balance

**Option A: total, then a remaining line only once money is recorded.** The card keeps the design's total; a muted line "المتبقي ₪X" appears for a partly paid order, "مدفوع" for a fully paid one, nothing for an unpaid or cancelled one.
- Pros: the card matches the design board today; the balance appears exactly when it carries information; reuses `paymentState` from the order page.
- Cons: until feature 24, nothing on the card speaks about money at all.

**Option B: always show the remaining amount.** Every open order shows "المتبقي ₪X".
- Pros: the scope wording is visibly met from day one.
- Cons: until feature 24 it repeats the total on every card, which reads as noise and adds a line to every card on a 390 screen.

**Option C: the payment badge only.** The order page's badge (لم يُسجَّل دفع / دفعة جزئية / مدفوع), no amount.
- Pros: one more reuse of an existing part.
- Cons: does not say what is still owed, which the scope asks for, and puts two badges on one card.

### Page size and load more

**Option A: 20 per step through `?page=N`, rendered on the server, like the category pages.**
- Pros: works without JavaScript, survives refresh and the back button, reuses `parsePage` and the catalog's anchor jump; most customers never see the button.
- Cons: each step reads all earlier rows again.

**Option B: a client button calling a Server Action that appends the next rows.**
- Pros: smoother, reads only the new rows.
- Cons: the list resets on refresh or back, it needs a new client component and its own loading and error states, and it differs from every other list in the shop.

### Item count

**Option A: lines (distinct items).** **Option B: units (sum of quantities).** **Option C: both.**
- Lines stay short and match the order page's list; units grow large for electricians (hundreds of bulbs) and say little about what the order holds; both is the most precise but crowds the card's meta line.

## Rationale

The balance line follows the data, not the calendar. Showing "المتبقي" equal to the total on every card before any payment exists would teach customers to ignore the line, and the moment feature 24 starts recording payments the line would need to become meaningful anyway. Option A meets the scope as soon as there is something owed that differs from the total, and on a cancelled order says nothing, matching the order page (spec 0015 AC-11), which leaves refunds to the payments and returns features.

Address based paging wins because the storefront already has it and it is the boring choice: one pattern for every list, no client state, and a page that survives the back button on a slow phone. Re reading earlier rows costs nothing measurable at this shop's volume; a cursor is the fix if it ever does. Twenty per step covers nearly every regular customer in one screen while keeping an electrician's long history light. Lines are the count a customer recognizes from the order page, and they stay readable for the large electrician orders the shop expects.

The account tab and the default landing move to My Orders because spec 0017 planned it and because orders are what a returning customer comes back for; the profile is one link away, and `/account` keeps its own redirects so the password reset path is untouched.
