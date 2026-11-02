# 0015. Order page and guest lookup: rationale

Decision record for [index.md](index.md). `/develop` builds from the index; this file holds the why.

## Context

Most customers order as guests: there are no accounts yet (feature 18). Each W5 message the customer sends already carries a link to `/orders/<number>`. The customer and the owner both tap that link, often from WhatsApp's own in app browser, which shares no cookies with the browser that placed the order. Today that link leads nowhere.

Order numbers run in sequence (`YY-NNNNN`, spec 0002), so a number is not a secret. The only other thing a guest reliably knows is the phone they typed at checkout. That phone is stored as typed and as E.164 (`customer_phone_e164`, indexed), and Palestinian and Israeli numbers can be written many ways (spec 0005). An order also holds a home address, a name, and notes, which the project treats as personal data that must never be logged or exposed.

Scope fixes the rule: order number plus phone, with limits on repeated attempts. The stack already offers Workers rate limit bindings (5 per 60s on checkout), a cookie pattern for "this browser may see this order" (`skf_placed`, spec 0004 AC-11), a reusable `OrderSummary` card (spec 0013), and the dashboard's status path rules (spec 0014). The shop is small, so tens of orders a day and few lookups.

## Options considered

### Option 1: Server rendered page, unlocked by a cookie of order ids

A match adds the order's uuid to an httpOnly `skf_tracked` cookie. The page checks the id against that cookie and `skf_placed`.

**Pros**:
- Same proven pattern as `skf_placed`. A uuid is unguessable, so no signing secret is needed.
- Refresh, back, and return visits work. The URL stays clean and shareable without exposing access.

**Cons**:
- Access lives in one browser. A second device needs another lookup.
- An id can't be revoked short of the cookie expiring (30 days).

### Option 2: Signed token cookie

An HMAC signed cookie holding the order id and an expiry.

**Pros**:
- Expiry is part of the token, and it can be revoked by rotating the secret.

**Cons**:
- Adds a secret to parse, store, and rotate, for no gain over an unguessable uuid in an httpOnly cookie.

### Option 3: Secret key in the URL

`/orders/<n>?k=<token>`, sent in W5 and shown after lookup.

**Pros**:
- Works on any device, and the W5 link opens the page directly.

**Cons**:
- The key leaks through forwarded chats, screenshots, browser history, and Cloudflare request logs (observability is on). It needs a migration for the token column.

### Option 4: No saved access

Render the order straight from the POST result.

**Pros**:
- Nothing persists in the browser, so it's the safest choice on shared devices.

**Cons**:
- Every refresh or return means typing both numbers again, and `/orders/<n>` itself never opens.

## Rationale

Option 1 fits the forces. The number isn't secret, so the cookie must hold something that is: the uuid already plays that role for `skf_placed`, and copying the pattern keeps one mental model and zero new secrets. A URL key (Option 3) would make the W5 link self contained, but W5 is forwarded and logged, and that is exactly where a key should not travel. Signing (Option 2) protects against forging a value that is already unguessable.

The details follow the same forces. The phone is matched as E.164 because customers write it inconsistently, and a strict match would lock out real owners. Every miss returns the same answer from the same query, so a probe learns nothing about which half was wrong. Two limiters (per IP and per number) cover both a single noisy client and a distributed guess at one order without a migration. An exact database counter was rejected as more machinery than a low traffic shop needs. The page shows the zone only, because a phone plus a guessed sequential number should never reveal a home address. The timeline follows the fulfilment path from `PATHS`, so the customer sees the same truth the owner sets. A cold open redirects to the lookup with the number filled in rather than a 404: the W5 link then always leads somewhere useful, and real and unknown numbers look identical. The owner redirect reuses `getAdminAccess()` and only runs when a session exists, so guests pay no Auth call.
