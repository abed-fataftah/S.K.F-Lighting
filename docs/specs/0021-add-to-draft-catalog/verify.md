# Verify: Add to draft from the catalog · spec 0021 · updated 2026-11-04
_Steps derived from spec 0021 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Signed out, then as a customer, then as the owner: open home, a category page, search, and a product page → no "أضف إلى مسودة" button on any card or on the product page → AC-1
- [ ] As an electrician, open a product page → the outline "أضف إلى مسودة" button sits between "أضف للسلة" and WhatsApp; on an out of stock product it is disabled → AC-2
- [ ] As an electrician on a category page → each card has a round 44×44 button in the photo's end corner; tapping it opens the sheet, not the product; Tab reaches it right after the card's name link; out of stock cards show it disabled → AC-3
- [ ] Open the sheet → title "أضف إلى مسودة", the product name and its code; a skeleton while it loads; Escape, the close button, and tapping outside close it and focus returns to the trigger → AC-4
- [ ] Block the `readDraftPicker` request (devtools offline) and open the sheet → "تعذّر تحميل المسودات." with "إعادة المحاولة"; go back online and retry → the form loads → AC-4
- [ ] Hide the product in the dashboard, then open the sheet from a stale card → "هذا المنتج لم يعد متوفرًا." and only a close button → AC-4
- [ ] Product with sizes and colours → selects follow quick order: colour waits for a size, unavailable choices read "(غير متوفر)" and are disabled; before a choice the line reads "من ₪…" when prices differ; after, "سعر الوحدة: ₪…" → AC-5
- [ ] From the product page with `?v=` and the stepper at 3 → the sheet starts on that option with quantity 3; from a card → nothing chosen and quantity 1; a single option product settles at once → AC-5, AC-6
- [ ] Type "abc", "0", "1000" in the quantity and confirm → "أدخل كمية من 1 إلى 999." and focus moves to the field; "٢" is accepted → AC-6
- [ ] With several drafts → radio rows newest edit first, each with its line count ("سطر واحد", "سطران", …); the newest is chosen; a full draft reads "30 / 30" and is still choosable → AC-7
- [ ] With no drafts → only "+ مسودة جديدة", already chosen, with "اسم المسودة" shown; with 30 drafts → that row is disabled with "وصلت إلى 30 مسودة" → AC-7
- [ ] Confirm with no option → "اختر الحجم واللون." and focus on the first select still waiting → AC-8
- [ ] Add an option already on the draft → its line's quantity grows; add one not there → a new line goes last; a line holding only that product stays and a new line is added → AC-8
- [ ] New draft row with "a", then a 41 character name, then an existing name in another case, then at 30 drafts → each message under the name field, and nothing is created → AC-9
- [ ] A successful add → the sheet body becomes "أُضيف إلى «…»" with "السطر N · الكمية Q" (or "الكمية الآن Q" on a merge), focus on that heading; "فتح المسودة" opens the draft; "متابعة التسوق" closes and leaves the page's option and stepper as they were; reopening starts fresh → AC-10
- [ ] Push a merge past 999 → "هذا الخيار في السطر N بكمية C. لا يمكن أن تتجاوز الكمية 999." and the typed quantity stays → AC-11
- [ ] Add to a draft with 30 lines (a new option) → "المسودة «…» ممتلئة (30 سطرًا)…" → AC-11
- [ ] Mark the chosen option unavailable in the dashboard, then confirm → "هذا الخيار لم يعد متوفرًا.", the selects reload and clear that option, the quantity and typed name stay → AC-11
- [ ] Delete the chosen draft in another tab, then confirm → "لم تعد هذه المسودة موجودة.", the list reloads and the newest draft is chosen → AC-11
- [ ] Demote the electrician to customer in the dashboard, then confirm in an open sheet → the sheet closes and the page refreshes without the buttons → AC-1
- [ ] Keep the draft open in quick order in another tab, add from the catalog, switch back → the new or merged line shows after the visibility reload → AC-12
- [ ] At 390 and 1280: the sheet sits in the 480 column, scrolls inside when tall, no sideways scroll, every control at least 44×44 → AC-14

## Commands
- [ ] `pnpm exec vitest run src/features/drafts src/features/catalog/card-view.test.ts` → all pass (`planCatalogAdd`, `commitPickerQuantity`, `pickerStart`, `chooseDraft`, `addToDraftSchema`, `CardProduct.productId`) → AC-15
- [ ] `pnpm exec vitest run src/features/drafts/server/add-from-catalog.db.test.ts` with the local database → 15 pass, not skipped → AC-8, AC-9, AC-15
- [ ] `pnpm exec playwright test e2e/add-to-draft.spec.ts --project=phone --project=desktop` → 8 pass, axe clean on the category page and the open sheet → AC-14, AC-15
- [ ] Watch the server log during an add, a refusal, and a failed picker read → only `draft_item_added` (`merged`, `newDraft`), `draft_refused` (error name, `fields: ["name"]` for a name problem), and `draft_picker_failed`; never a draft name, product, or id → AC-13

## Value sourcing
- [ ] `canAddToDraft`: change only `profiles.role` in the database between page loads → the buttons appear and vanish on the next request, with no sign out → Value sourcing: catalog pages
- [ ] Card product id: open the sheet from a card and compare the code shown with the card's code → Value sourcing: card button
- [ ] Listed and sellable: hide the category (not the product) and confirm → `not_sellable` → Value sourcing: `addToDraft` listed and sellable
- [ ] Existing line: add the same option twice from two tabs at once → one line with the summed quantity → Value sourcing: existing line for the option
- [ ] Product page start: change the size chip, then open the sheet → the sheet follows the changed option, not the URL's first one → Value sourcing: product page button
- [ ] Prices: change an option's price in the dashboard and reopen the sheet → the new price shows → Value sourcing: sheet prices
- [ ] Draft order: edit an older draft in quick order, then reopen the sheet → it is now first and chosen → Value sourcing: draft rows, chosen draft
- [ ] Draft limit: at exactly 30 drafts the new row is disabled; delete one and reopen → enabled → Value sourcing: new draft row disabled
- [ ] Merged quantity with an empty line quantity: set a line's option with no quantity in quick order, then add 4 of it → "الكمية الآن 4" → Value sourcing: merged quantity
- [ ] Sort and position: add to a draft whose lines were reordered or partly removed → the new line lands last and the success block's position matches quick order's line number → Value sourcing: new line `sort`, `position`
- [ ] `current` on refusal: merge past 999 → the message's quantity equals the line's quantity in quick order → Value sourcing: `current`
- [ ] Draft name: rename the draft in another tab, then add → the success block shows the new name → Value sourcing: `draftName`
- [ ] "فتح المسودة" href → `/account/quick-order?draft=<id>` of the draft just added to → Value sourcing: success link

## Acceptance-criteria coverage
- AC-1: UI 1, 20; Value sourcing 1 · AC-2: UI 2 · AC-3: UI 3 · AC-4: UI 4 to 6 · AC-5: UI 7, 8 · AC-6: UI 8, 9 · AC-7: UI 10, 11 · AC-8: UI 12, 13; Commands 2 · AC-9: UI 14; Commands 2 · AC-10: UI 15 · AC-11: UI 16 to 19 · AC-12: UI 21 · AC-13: Commands 4 · AC-14: UI 22; Commands 3 · AC-15: Commands 1 to 3
