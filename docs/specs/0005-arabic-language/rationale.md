# 0005. Arabic language rules: rationale

Decision record for [index.md](index.md). The build spec is there; this file holds the context, options, and reasoning.

## Context

The shop is Arabic only and right to left (spec 0001, amended 2026-10-17). The design boards use Western digits and `₪20` style prices, but `docs/design/design.md` section 3 left the real decision open (O-2): which digits, how prices and dates read, and how Arabic text is matched in search. Specs 0003 and 0004 build on an interim rule and both name this feature as the owner of the final one.

The runtime does not settle it by default. On the Node used here (ICU 78, CLDR 48), `Intl` formats the locale `ar` with Western digits, `ar-PS` with Arabic Indic digits (`١٬٢٥٠`), and `ar-PS` uses Levantine month names while `ar` uses Egyptian ones. Browsers have changed these defaults over the years, and the Worker renders in UTC while shoppers sit in any time zone. Left alone, the same order could show different digits and even a different date on the server, in the browser, and in WhatsApp. `Intl` also inserts invisible direction marks (U+200F) into Arabic dates, which leak into copied text and break exact string tests.

Text typed by people brings its own problems. Phone keyboards in Palestine often type Arabic Indic digits, so a phone field that accepts only `0` to `9` blocks real customers. Owners paste names with tatweel, double spaces, or invisible marks from other apps. And without a rule, an English product name can reach an Arabic only shop. Search (feature 11) will need a matching rule for the common spelling slips (أ / ا, ة / ه, ى / ي).

The clock itself is a choice. Spec 0001 said `Asia/Jerusalem`, but the West Bank (`Asia/Hebron`) changes its clocks on different days: in 2026 summer time starts on 28 March instead of 27 March, and winter time on 24 October instead of 25 October, so on those days the two zones differ by an hour. The shop and its owner are in the West Bank.

Not deciding means each feature picks its own format. The cost lands on the owner and customers as prices and dates that disagree across pages, and on every later spec as the same question asked again.

## Options considered

### Option 1: Own pure functions pinned to Western digits, with a rule test

A small set of pure functions (`formatPrice`, `formatDate`, `formatTime`, `formatDateTime`, `formatNumber`, `formatPhone`). Numbers and prices are grouped by plain string code, with no `Intl`. Dates and times read numeric 24 hour parts from one `Intl.DateTimeFormat` in the shop's time zone, and the code builds `DD/MM/YYYY` and the 12 hour clock with `ص`/`م` itself, so no locale data, direction mark, or ICU version can change the output. Messages receive preformatted strings. Arabic text rules (digit conversion, tidying, the Arabic letter check, search folding) are pure functions too, used through shared Zod pieces. A Vitest scan fails on any other formatting path.

**Pros**:
- Identical output on Workers, in the browser, and in WhatsApp text, unit tested without mocks (the project's functional style rule).
- Explicit numbering system and time zone, so no browser or server default can change the result.
- Strongest feasible enforcement for a pattern rule: CI fails, like the design rule test that already works here.

**Cons**:
- Gives up next-intl's formatter, so every count in a message needs a preformatted argument.
- Hand assembling dates from parts is a little more code than one `Intl` call.

### Option 2: next-intl's formatter with global formats

Use `useFormatter` / `getFormatter` with named formats in `request.ts`, and ICU `{n, number}` inside messages.

**Pros**:
- The idiomatic next-intl path; less custom code in components.
- Numbers inside messages format themselves.

**Cons**:
- next-intl formats with its request locale, `ar`, so the digit style rests on each runtime's default for `ar` unless the routing locale itself changes.
- WhatsApp messages and pure functions outside React still need their own formatter, so two paths exist anyway and can drift.
- Harder to unit test without the next-intl context.

### Option 3: Both, split by place

next-intl in components, pure functions in Server Actions and WhatsApp builders.

**Pros**:
- Each place uses what is closest to hand.

**Cons**:
- Two implementations of the same rule; the first time they differ, a customer sees `₪1,250` on the page and `1,250 ₪` in WhatsApp.
- The rule test cannot ban either path, so enforcement drops to code review.

### Option 4: Convention only

Write the rules in `AGENTS.md` and rely on review.

**Pros**:
- No test to maintain.

**Cons**:
- The weakest enforcement; AI agents default to `toLocaleString`, which quietly brings back Arabic Indic digits or a browser time zone.

## Rationale

The force that decides it is that the same values must read the same in three places that share no runtime: a server render on Workers in UTC, a client component in a browser in any zone and language, and plain WhatsApp text. Only functions that pin the numbering system and the time zone themselves give one answer everywhere, and pure functions fit the project's rule that money and display logic are unit tested without mocks. next-intl stays for what it is good at (messages and plural words) but stops formatting numbers, which also removes its locale from the digit question. A rule test is the enforcement level this project already trusts for the design tokens, and it is cheap here because the tree has almost nothing to migrate.

The engineer's picks follow the same forces. Western digits match the approved boards, product codes, order numbers, and the digits customers type for phones. `₪1,250` is the interim rule every screen already uses, so nothing changes visually. Numeric `DD/MM/YYYY` dates avoid the Levantine versus Egyptian month name question entirely and stay short in tables; padded day and month line up in columns. 12 hour times with `ص`/`م` are how people in Palestine say times. The middle dot joiner matches the boards (info strip, drafts card) and avoids `Intl`'s hidden marks. Relative times were declined to keep output stable and testable.

For text, converting Arabic digits only in number fields keeps the owner's wording intact while never blocking a customer. Tidying keeps tashkeel and hamza, so the shop shows what the owner wrote, but drops tatweel and invisible marks, which also closes a small spoofing gap in notes. "At least one Arabic letter" is the strict enough rule that still allows real names like `ثريا كريستال Philips 60W`. The search folds are the full set the engineer chose; the Persian `ی` and `ک` fold is left to feature 11, which can measure whether it is needed.

The time zone is `Asia/Hebron` because the owner reads order and payment times on the West Bank clock; the cost is a one hour difference for customers in the 1948 areas on a few days a year, which matters far less than the owner's own records. Both zones are UTC+2 at New Year, so order number years do not move.

An independent cross check on another model shaped the details: `Intl` puts a hidden LRM (left to right mark) in the minus sign for Arabic, so numbers skip `Intl` entirely; `ص`/`م` are computed rather than read from CLDR (the Unicode locale data) so a Worker's ICU version cannot change them; number fields are tidied before their digits are converted, so a pasted direction mark never breaks a phone; and the message checks parse ICU instead of matching it with regular expressions.

Smaller calls made while writing: `formatPrice` and `formatNumber` throw on non integers because that is a bug, not user input; negative prices render `-₪50` inside `<Ltr>` because in right to left text the minus would otherwise jump to the far side; dates and times stay outside `<Ltr>` because `4:45 م` must read with `م` after the number; the time zone stays a constant, not an env var, because the shop has one location. The runner up for formatting (next-intl's formatter) remains the fallback if a future need for a second language appears, which spec 0001 has ruled out.
