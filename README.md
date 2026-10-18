# S.K.F Lighting shop

Arabic first online shop and owner dashboard. Next.js 16 on Cloudflare Workers (OpenNext), Supabase (Postgres, Auth, Storage), Drizzle. The full stack decision is in [spec 0001](docs/specs/0001-stack-architecture/index.md); the plan is in [docs/scope](docs/scope/index.md).

## Run it locally

You need Node 24 (see `.nvmrc`), pnpm 10, and Docker Desktop running.

```bash
pnpm install
pnpm db:start            # local Supabase: Postgres, Auth, Storage (first run downloads images)
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_ANON_KEY from the `pnpm db:start` output (the publishable/anon key)
pnpm dev                 # http://localhost:3000 (the shop is Arabic only)
```

## Useful scripts

| Script                                 | What it does                                                             |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`                             | Next.js dev server with Worker bindings available                        |
| `pnpm build`                           | Next.js production build                                                 |
| `pnpm preview`                         | Build for Workers and run it locally on workerd (do this before pushing) |
| `pnpm deploy`                          | Build and deploy to Cloudflare                                           |
| `pnpm typecheck` / `pnpm lint`         | Type check and lint                                                      |
| `pnpm db:generate` / `pnpm db:migrate` | Create and apply Drizzle migrations (public schema)                      |
| `pnpm db:start` / `pnpm db:stop`       | Start or stop the local Supabase stack                                   |
| `pnpm cf-typegen`                      | Regenerate `cloudflare-env.d.ts` after changing `wrangler.jsonc`         |

## Runbooks

- [Production Supabase settings](docs/runbooks/supabase-production.md)
- [Admin sign in and authenticator codes](docs/runbooks/admin-mfa.md)
