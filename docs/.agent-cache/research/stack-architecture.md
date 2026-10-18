# Stack research: lighting e-commerce (AR/RTL, mobile first, ILS, WhatsApp orders)

Date of research: 2026-10-16. Budget: $25/month free-tier target.
Legend: [F] = fetched from official page this session. [S] = seen in search snippet only (not opened). [U] = unverified.

## 1. Framework

- **Next.js 16.4** (latest release, shipped 2026-10-06) [S: nextjs.org/blog listing]. App Router is the default model.
  - Cache Components is the new programming model; the team says it becomes the default in **Next.js 17**. create-next-app enables it for new apps.
  - `next upgrade --agent` command and `experimental.agentUpgrade` flag added in 16.4.
  - 16.3 (2026-08-03) brought Instant Navigations and faster dev/build.
  - **Security:** upstream image-optimization vulnerability (possible RCE on glibc Linux), advisory dated 2026-10-14. Fix: 16.4.1 (Active LTS) or 15.5.28 (Maintenance LTS), or ensure sharp >= 0.35.5. [S]
  - Server Actions: still part of App Router; no change found in this search. [U for details]
- **React Router v7** (Remix merged into it), **TanStack Start**, **Astro**: not researched this session. [U]
- Fit note: Next.js is the right default for SEO-heavy storefront plus admin; use 16.4.x, not 15.x, for new work. Pin the sharp version.

## 2. Database + BaaS

**Supabase** [F: supabase.com/pricing]
- Free: $0. 500 MB database, 1 GB storage, 50,000 MAU, 5 GB egress (+5 GB cached), 2 active projects.
- Free has **no daily backups**. [F]
- Free projects **pause after 1 week** of low database activity. [F]
- Pro: **from $25/month**. Paid projects are not paused for inactivity. [F]
- Pro daily backups kept 7 days; $10/mo compute credit included; PITR is a paid add-on (listed at $100/mo per 7-day retention). [S: search snippets, not opened on billing docs]
- Pause restore window: search snippets conflict (1 year vs older 90 days). [U, check Studio]
- Fit note: Postgres with RLS and a built-in storage and auth. Good for relational orders/balances. The free pause policy is a real risk for a shop: a quiet week pauses the store's database. Plan to move to Pro (or add a keep-alive cron) before launch.

**Neon Postgres** [F: neon.com/pricing]
- Free: fetched page says **1 GB storage per project, 20 GB total**, 100 CU-hours per project, 100 projects, **10 branches per project**, 6-hour history (no instant restore).
- Launch plan: pay-as-you-go, no monthly minimum, $0.106 per CU-hour, $0.35 per GB-month.
- Fit note: branching is a good match for preview deploys. Free tier has short history, so it is weak for backup needs. Domain moved from neon.tech to neon.com; reported acquisition by Databricks (2025) [U].

**Firebase**: not researched. [U] Firestore is NoSQL, a poor fit for relational orders and balances. Not recommended for this project.

## 3. Auth

- **Auth.js (NextAuth)**: now maintained by the Better Auth team. Per Better Auth's post (2025-09-22) [F: better-auth.com/blog/authjs-joins-better-auth]: existing users keep getting security patches and urgent fixes; limited development. Not called "maintenance mode" in the post. Do not start new projects on it.
- **Better Auth**: the post "strongly recommends" it for new projects. It covers email/password and reset, and roles via plugins. Gap: stateless sessions without a database (Auth.js has it). [F]. Search reports Vercel acquired Better Auth; MIT license stays. [S, unverified against primary]
- **Supabase Auth**: included with Supabase; email/password and reset built in. Fit if Supabase is the DB. Free tier MAU limit: 50,000. [F, via pricing page]
- **Clerk**: Hobby free plan 50,000 MRUs (monthly retained users) per app; Pro from $25/mo ($20/mo annual). [F: clerk.com/pricing]. Fit: fastest setup, but a third-party user store next to Postgres. Clerk bills on MRUs, not MAUs.
- Note: Arabic UI strings for auth emails and error messages must be handled by the app.

## 4. ORM

- **Prisma**: Prisma 7 removed the Rust query engine for TypeScript/WASM; package size reportedly cut sharply. Latest line reported as 7.10 with 8 in RC (one source, makerkit.dev updated 2026-09). [U, verify on npm]
- **Drizzle ORM**: reported stable 0.45.2 with 1.0 in beta. [U, single source]. Code-first, SQL-like; thin, good on serverless.
- Fit: Drizzle is a lighter fit for Next.js on serverless with Supabase or Neon. Prisma is easier for a solo dev who wants migrations and typed client conveniences. Either works; pick one and pin the version.

## 5. Hosting

**Vercel Hobby** [F: vercel.com/docs/plans/hobby, last_updated 2026-09-14]
- Hobby is restricted to **non-commercial, personal use only**. A paid shop is commercial use. Hobby is NOT allowed for this project. [F]
- Pro: **$20/mo** (pricing page via search snippet) [S]. Includes $20 credit. Dev seats $20/user/mo, viewer seats free [F].
- Hobby limits (fetched): 100 GB fast data transfer, 1M function invocations, 5,000 image transformations, 50,000 Web Analytics events/mo, 200 projects, 1 hour runtime logs.
- Fit note: best Next.js host, but budget for Pro ($20) from day one.

**Netlify, Railway, Cloudflare Workers + OpenNext**: not researched. [U]. OpenNext on Cloudflare is the free-tier candidate if Vercel Pro is too costly; verify adapter status before choosing.

## 6. Media

**Cloudflare R2** [F: developers.cloudflare.com/r2/pricing]
- Free: 10 GB-month storage, 1M Class A ops, 10M Class B ops, **egress free**. Beyond free: $0.015/GB-month.
- Fit: best storage for photos and video; pairs with Cloudflare Images or a Worker for resizing [U for those products].

**Supabase Storage**: free 1 GB; included in Supabase Pro [F for free limit; Pro storage allowance U]. Fit: simplest if Supabase is the DB; egress limits (5 GB on Free) are tight for photos.

**Cloudinary, Bunny**: not researched; free tiers and transformation pricing [U].

## 7. Error tracking + analytics

- **Sentry Developer (free)**: 5,000 errors/month. Team from $29/mo billed monthly or $26/mo annual. [F: sentry.io/pricing]
- **Vercel Web Analytics**: Hobby 50,000 events/mo included [F]; Pro adds on-demand events. Privacy-friendly, no cookies.
- **Umami, Plausible, PostHog**: not researched this session. [U]. Umami is self-hostable (free). Plausible has a paid cloud tier. PostHog has a free tier with event-based limits.

## 8. Email (password reset)

**Resend** [F: resend.com/pricing]
- Free: 3,000 emails/mo, 100/day. Pro: $20/mo for 50,000 emails. $35/mo tier for 100,000.
- Fit: fine for password reset and order confirmations. Free daily cap of 100 is tight at launch peaks.
- Alternatives (Postmark, SES, Brevo): not researched. [U]

## Freshness flags
- Next.js 16.4 is current; 17 will make Cache Components the default. Security advisory dated 2026-10-14: pin sharp >= 0.35.5 or use 16.4.1.
- Auth.js: maintenance-only; Better Auth recommended for new work.
- Vercel Hobby: commercial use prohibited. Plan on Pro ($20/mo).
- Supabase Free pauses after 1 week of inactivity; no backups on Free.
- Clerk moved from MAU to MRU billing (50k free).

## Unverified (did not confirm)
- React Router v7, TanStack Start, Astro status.
- Prisma 7.10 / Drizzle 0.45.2 / 1.0-beta version numbers (single source).
- Supabase pause-restore window (1 year vs 90 days).
- Supabase Pro daily backup retention (7 days) and Pro storage allowance.
- Neon acquisition and branching details beyond the pricing page.
- Netlify, Railway, OpenNext adapter status.
- Cloudinary, Bunny, Umami, Plausible, PostHog, Firebase pricing.
- Better Auth acquisition by Vercel (search report only).

## Confirmed URLs opened (fetched)
- https://supabase.com/pricing
- https://vercel.com/docs/plans/hobby
- https://www.better-auth.com/blog/authjs-joins-better-auth
- https://neon.com/pricing
- https://clerk.com/pricing
- https://resend.com/pricing
- https://developers.cloudflare.com/r2/pricing/
- https://sentry.io/pricing/

Seen in search results only (not opened): https://nextjs.org/blog/next-16-4 , https://nextjs.org/blog/nextjs-security-update-october-14-2026 , https://supabase.com/docs/guides/platform/free-project-pausing , https://vercel.com/docs/limits/fair-use-guidelines , https://vercel.com/pricing
