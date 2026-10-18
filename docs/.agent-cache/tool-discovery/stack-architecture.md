# Agent Skills and MCP discovery: stack-architecture (2026-10-16)

## Next.js 16 / React
- Skills: vercel-labs/agent-skills (vercel-react-best-practices, vercel-composition-patterns) · React/Next perf and composition · `npx skills add vercel-labs/agent-skills` · confirmed (--list)
- Skills: cloudflare/skills (nextjs-on-cloudflare) · Next.js on Cloudflare · `npx skills add cloudflare/skills` · confirmed (--list lists skill set; nextjs-on-cloudflare found in find)
- MCP: Next.js devtools MCP · official (vercel) · `claude mcp add next-devtools -- npx -y next-devtools-mcp@latest` · runtime introspection · unconfirmed

## TypeScript
- Skills: none official found; community: wshobson/agents (typescript-advanced-types) · `npx skills add wshobson/agents` · unconfirmed

## Supabase (Postgres, Auth, Storage)
- Skills: supabase/agent-skills (supabase, supabase-postgres-best-practices) · official · `npx skills add supabase/agent-skills` · confirmed (--list)
- MCP: Supabase MCP · official · `claude mcp add --transport http supabase https://mcp.supabase.com/mcp` (OAuth) · query/migrate/logs; confirmed by web search (remote, OAuth)

## Drizzle ORM / drizzle-kit
- Skills: lobehub/lobehub (drizzle), giuseppe-trisciuoglio/developer-kit (drizzle-orm-patterns), mindrally/skills (drizzle-orm) · community · `npx skills add mindrally/skills --skill drizzle-orm` · unconfirmed
- MCP: none official found (community Drizzle MCP servers exist on glama.ai) · none found (official)

## Cloudflare Workers + OpenNext
- Skills: cloudflare/skills (cloudflare, wrangler, workers-best-practices, nextjs-on-cloudflare) · official · `npx skills add cloudflare/skills` · confirmed (--list)
- MCP: Cloudflare MCP · official · `claude mcp add --transport http cloudflare https://docs.mcp.cloudflare.com/mcp` · docs/API access; unconfirmed
- Note: @opennextjs/cloudflare-specific skill only community: null-shot/cloudflare-skills (cloudflare-opennext), 462 installs · unconfirmed

## Tailwind CSS v4
- Skills: no official Tailwind Labs skill found; community: lombiq/tailwind-agent-skills (tailwind-4-docs), wshobson/agents (tailwind-design-system) · `npx skills add lombiq/tailwind-agent-skills` · unconfirmed
- MCP: none found

## shadcn/ui
- Skills: shadcn-ui/ui (shadcn, migrate-radix-to-base) · official · `npx skills add shadcn-ui/ui` · confirmed (--list)
- MCP: shadcn MCP · official (shadcn CLI) · `claude mcp add shadcn -- npx shadcn@latest mcp` · component search/examples; unconfirmed (only third-party found in search)

## next-intl
- Skills: github/awesome-copilot (next-intl-add-language) · community · `npx skills add github/awesome-copilot --skill next-intl-add-language` · unconfirmed; no official skill found
- MCP: none found

## Zod / react-hook-form
- Skills: pproenca/dot-skills (zod, react-hook-form) · community · `npx skills add pproenca/dot-skills` · unconfirmed; jezweb/claude-skills (react-hook-form-zod) · unconfirmed
- MCP: none found

## Vitest
- Skills: supabase/supabase (vitest) · official-vendor · `npx skills add supabase/supabase --skill vitest` · unconfirmed; antfu/skills (vitest) · community · unconfirmed
- MCP: none found

## Playwright
- Skills: microsoft/playwright-cli (playwright-cli) · official · `npx skills add microsoft/playwright-cli` · confirmed (--list)
- MCP: Playwright MCP · official (Microsoft) · `claude mcp add playwright -- npx @playwright/mcp@latest` · browser automation; confirmed by web search

## Resend
- Skills: resend/resend-skills (resend, react-email, email-best-practices, resend-cli, agent-email-inbox) · official · `npx skills add resend/resend-skills` · confirmed (--list)
- MCP: none found (Resend CLI covers ops)

## GitHub Actions
- Skills: no official found; community: wshobson/agents (github-actions-templates), callstackincubator/agent-skills (github-actions) · unconfirmed
- MCP: GitHub MCP · official (GitHub) · `claude mcp add --transport http github https://api.githubcopilot.com/mcp/` · repo/PR/Actions access; unconfirmed

## Docs lookup (cross-stack)
- MCP: Context7 · community (Upstash) · `claude mcp add context7 -- npx -y @upstash/context7-mcp` · current library docs; configured via npx (confirmed by search)
