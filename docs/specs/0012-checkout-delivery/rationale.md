# 0012. Checkout and delivery: rationale

## Context

Spec 0004 shipped the checkout as a tracer bullet: the form, pickup or delivery, the zones with their fees, the stale total check, idempotency, and the rate limit. Its validation only checks length, so `aaa`, `12345`, or a single first name go through. The scope asks feature 13 to reject "invalid or unrealistic entries" with clear messages, and specs 0002 and 0004 left three questions for it: whether `area` is a field, whether the `normalizePhone` rules are final, and whether checkout needs bot protection beyond the rate limit.

The forces: the shop delivers across the West Bank and the '48 areas, so towns run to hundreds of names, many villages, written in more than one way. Customers fill this on a phone, often once, so every extra field or strict rule costs orders. The owner contacts every customer on WhatsApp, which needs a mobile number. The site is Arabic only, guest only until accounts (18), and there is no checkout spam yet.

## Options considered

### Option 1: Tighten the shared schema in place

Add realism checks as Zod helpers, use them in the existing `checkoutSchema` (which the form and the action already share), add a live recheck to the existing form and a honeypot to the existing action.

**Pros**:
- No migration, no new service, no new library.
- The same rules serve later forms (accounts, drafts).

**Cons**:
- Free text towns stay inconsistent.
- Rule based realism can refuse a rare genuine entry.

### Option 2: Structured location (town list per zone)

A managed list of towns per zone, picked from a searchable field, plus an optional neighbourhood field stored in `orders.area`.

**Pros**:
- Clean, reportable location data; no misspelled towns.

**Cons**:
- Hundreds of towns to seed and maintain in the dashboard; a missing village blocks an order.
- A new table and migration, and more friction on a phone.

### Option 3: Rebuild the form on react-hook-form with Turnstile

Move the form to react-hook-form with `zodResolver` for live validation, and add Cloudflare Turnstile verification on the server.

**Pros**:
- Richer client validation modes; stronger bot protection.

**Cons**:
- Rewrites a working form that relies on `useActionState`, the stale total refresh, and idempotent retries.
- Turnstile adds a script, a secret, and a small chance of blocking a real customer, for spam that does not exist yet.

## Rationale

Option 1 fits the forces. The gap is in the rules, not in the structure: the form, action, and data model from spec 0004 are sound, so the cheapest correct change is stricter helpers in the one shared schema, which gives the browser and server the same answer. A town list (Option 2) solves a reporting problem the shop does not have yet while adding friction and upkeep on the one screen that turns visits into orders. Rebuilding on react-hook-form (Option 3) buys nothing a small live recheck cannot do, and risks the stale total and retry behaviour that already works.

Smaller calls made here:
- **Live recheck with `safeParse`, not react-hook-form.** Keeps `useActionState` and the server as the authority. Errors clear on input but are set only on blur, so a half typed phone does not flash an error at every keystroke (the cross check's point; the engineer agreed). Runner up: react-hook-form with `mode: "onSubmit"` and `reValidateMode: "onBlur"`, which does the same with a dependency and a rewrite.
- **Hyphens, dots, and brackets allowed** (hyphen in names; hyphen, dot, and brackets in cities). The first draft refused them, which would block `Abu-Bakr`, `رام الله - البيرة`, and `القدس (الشرقية)`; the letter and word checks still catch junk.
- **Honeypot named `company_fax_2` in an `inert` wrapper.** A field named `website` is a known autofill target, and a false positive would trap a real customer on every retry; `inert` also keeps it out of focus, clicks, and voice control.
- **Honeypot checked before parsing.** A bot learns nothing from field errors and does not use up a real customer's rate limit on a shared IP. It answers `save_failed` rather than a fake success, so a person caught by mistake is never told an unsaved order went through. Runner up: answering a fake confirmation, which hides the trap better but would mislead a real person.
- **Letters as `\p{L}` of any script.** Arabic and Latin names are both common; limiting to two scripts by code range would miss Arabic presentation forms and accented Latin names for no gain.
- **Repeat limit of 5, digits exempt.** Catches keyboard mashing (`ههههه`, `.....`) while allowing real plot and building numbers like `00000`.
