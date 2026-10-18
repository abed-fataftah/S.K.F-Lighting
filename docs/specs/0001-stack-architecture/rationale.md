# 0001. Stack and architecture: rationale

Decision record for [index.md](index.md). Read by people and by `/architect` on update; `/develop` skips it.

## Context

S.K.F Lighting needs an Arabic first, phone first online shop with a public storefront (browse, cart, guest checkout, orders sent out through WhatsApp links) and an owner dashboard (products, orders, cash and cheque payments, customers, electrician pricing, later loyalty coins and returns). Prices are in shekels; no online card payment at launch. The scope has 34 features across 10 slices, several of them money sensitive (`GA` tier: accounts, roles, price adjustments, payments, returns).

Forces that shaped the choice:
- **Builder**: one person, with AI agents writing most of the code, who knows React and Next.js. Tools must be mainstream, well documented, and known to AI models.
- **Budget**: free tiers first, around $25 per month at launch.
- **Data**: strongly relational (products with size and colour options, orders with price at time of order, payments, balances). Correctness of totals and balances matters more than raw speed.
- **Operations**: daily backups with a tested restore are a launch requirement (feature 30). No one is available to run servers.
- **Reach**: Arabic pages must be readable by search engines and preview well on WhatsApp and Facebook (feature 28).
- **Sign in**: accounts use email + password or Google; guests order without an account; the admin account guards every customer's phone and address.

Not deciding blocks every feature: slice 1 (first order end to end) needs a running app, database, and admin sign in.

## Options considered

### Option 1: Next.js on Cloudflare Workers + Supabase Pro + Drizzle (chosen)

One Next.js app deployed to Workers through OpenNext; Supabase provides Postgres, Auth, Storage, and image resizing; Drizzle handles data access in server code.

**Pros**: about $30 per month with daily backups and no pausing; one vendor for data, auth, and files; Cloudflare allows commercial use on cheap plans and runs DNS too; Drizzle runs well on Workers.
**Cons**: the OpenNext adapter adds setup and may trail new Next.js releases; two core vendors; authorization lives in application code.

### Option 2: Next.js on Vercel Pro + Supabase Pro

The same app and backend, hosted where Next.js is built.

**Pros**: zero config Next.js, every feature works on release day, best preview and image tooling.
**Cons**: about $45 per month, well over budget, because Vercel's free Hobby plan forbids commercial use; per seat pricing if a developer joins.

### Option 3: Next.js on Cloudflare Workers + Neon + Better Auth + Cloudflare R2

Assemble the backend from separate free tier pieces.

**Pros**: close to $5 per month; Neon branching gives a database per preview; R2 has no egress fees; Better Auth is the current recommended self hosted auth library.
**Cons**: four services to wire and secure instead of one; you own the auth tables, email flows, and MFA setup; Neon's free tier has a 6 hour restore window, not daily backups, so backups become your job before launch.

### Option 4: React Router v7 (framework mode) on Cloudflare + Supabase Pro

A lighter React framework that runs natively on Workers without an adapter.

**Pros**: first class Workers support, simpler data loading and forms, no adapter lag.
**Cons**: the engineer knows Next.js, not React Router; smaller ecosystem for admin tooling, next-intl style i18n, and SEO helpers; AI agents have less training on it. Not verified against the current landscape in this run.

## Rationale

The budget and the "no one runs servers" constraint decide most of it. Supabase Pro is the only option that delivers the launch requirement for daily backups, plus auth with MFA and Google, plus file storage and image resizing, for one fixed $25 bill and with no glue code. Option 3 is cheaper but hands the solo builder four services and the backup job; that saving is not worth the operational load on a shop that takes real cheque and cash balances.

With Supabase taking $25, hosting has to be about $5. Vercel would be the smoothest Next.js host, but its free plan forbids commercial use and Pro pushes the total to about $45. Cloudflare Workers Paid fits, allows commercial use, and puts DNS and the R2 backup bucket in the same account. The adapter risk is real but bounded: it is the officially maintained path, and a follow up item gives a concrete fallback (Next 15.5 on Workers, or Vercel Pro) if the pinned version does not work.

Next.js over React Router (Option 4) because the engineer already knows it and the agents writing the code know it best; that matters more than a slightly cleaner Workers story. Drizzle over the Supabase client with RLS policies because the hardest rules in this shop (balances, price adjustments, coins, returns) are money logic that must be unit tested and reviewed, which is far easier in TypeScript than in SQL policies; RLS stays on as a lock on the browser door. Drizzle over Prisma because it is lighter on Workers and its SQL first style keeps reports readable.

On Workers, OpenNext was chosen over vinext even though Cloudflare's guide and its `nextjs-on-cloudflare` skill now default to vinext. vinext reimplements the Next.js API on Vite and does not promise full parity; for a solo builder whose AI agents lean on Next.js knowledge, and with next-intl and Supabase SSR in the stack, running the real Next.js build is the safer bet, and it keeps Vercel as a no code change fallback. Revisit vinext once it is proven with these libraries.

Smaller calls made in the spec, with the runner up:
- **Dynamic rendering at launch** over ISR caching: edits must show right away and the traffic is small. Runner up: OpenNext R2 incremental cache with tag revalidation, once a slow page is measured.
- **Hyperdrive** over connecting straight to Supabase's transaction pooler: it is included in Workers Paid and removes a fresh TLS and connection handshake on every request (a cross check finding). Runner up: the transaction pooler with `prepare: false`.
- **Frankfurt region with an explicit placement hint**: closest major Supabase region; the hint keeps the Worker beside the database. Smart Placement was the first pick but only adapts after measuring traffic, so it is the fallback.
- **Session pooler for migrations and backups**: Supabase's direct database address is IPv6 only and GitHub runners are IPv4.
- **`getClaims()` for reads, `getUser()` for admin writes**: one fewer network call on most pages, the strongest check where money and roles change.
- **Signed direct uploads** over uploading through the Worker: avoids Worker request size limits for videos.
- **Weekly encrypted `pg_dump` to R2 kept 12 weeks**: cheap insurance beyond Supabase's 7 day window; encrypted because dumps hold customer phones and addresses.
- **Page caching left out**: a 60 second shared cache was suggested in the cross check, but it conflicts with "edits show right away" and cookie dependent pages; revisit only if pages are measured slow.

## References

**Project sources**:
- `docs/scope/index.md` and area files: launch set, budget sensitive features, GA tier features, guest order rules, languages
- `docs/scope/foundations.md`: feature 1 done when line (stack, sign in, storage, hosting recorded)
- `docs/scope/site.md`: feature 30 backup and restore requirement
- `docs/.agent-cache/research/stack-architecture.md`: the landscape check run for this decision (16 Oct 2026)
- Installed skill `nextjs-on-cloudflare` (`cloudflare/skills`): Cloudflare's vinext default, weighed and set aside above

**Practices & standards**:
- Monolith first for small teams
- Relational database as the default for relational data
- Never build auth from scratch; use the platform's proven auth
- Object storage for files, never the database
- Database built in search before a search engine
- Server side validation of every input, even when the browser validates
- Least privilege: deny direct browser database access (RLS with no policies)
- 3 2 1 backup thinking: an off site copy beyond the provider's own backups

**Links** (web verified during the landscape check):
- Supabase pricing: https://supabase.com/pricing
- Vercel Hobby plan (non commercial use only): https://vercel.com/docs/plans/hobby
- Auth.js joins Better Auth: https://www.better-auth.com/blog/authjs-joins-better-auth
- Neon pricing: https://neon.com/pricing
- Clerk pricing: https://clerk.com/pricing
- Resend pricing: https://resend.com/pricing
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Sentry pricing: https://sentry.io/pricing/

### Landscape check summary (16 Oct 2026)

- Next.js 16.4 current; Cache Components become the default in Next 17; security advisory 14 Oct 2026, fixed in 16.4.1 and 15.5.28.
- Supabase Free: 500 MB DB, 1 GB storage, pauses after a week of low activity, no daily backups. Pro: $25, no pausing, daily backups.
- Vercel Hobby: non commercial only; Pro $20 per month.
- Auth.js in maintenance under the Better Auth team; Clerk bills on monthly retained users, 50k free.
- Cloudflare R2: 10 GB per month free, free egress.
- Resend: 3,000 emails per month free (100 per day).
- Sentry: 5k errors per month free.
- Not verified in this run: React Router v7, TanStack Start, Astro, Prisma and Drizzle current versions, OpenNext support for Next 16.4, Supabase image transformation quota, Netlify and Railway pricing.
