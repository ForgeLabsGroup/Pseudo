# Development setup

1. Node 22+, pnpm 10 (`corepack enable`). `pnpm install`.
2. **Supabase** (one person does this, shares keys):
   - Create project → SQL Editor → paste `supabase/migrations/20261101000000_init.sql` → Run.
     (or `npx supabase link --project-ref <ref> && npx supabase db push`)
   - Also run `supabase/migrations/20261101010000_character_refs.sql`, `20261101020000_research.sql`, `20261101030000_research_storage.sql` and `20261101040000_provider_usage.sql` (in order; `research_storage` creates the private `research-videos` bucket).
   - CLI route (preferred): `pnpm exec supabase login`, then `pnpm db:link --project-ref <ref>` (ref = subdomain of your project URL), `pnpm db:status`, `pnpm db:push`.
   - Authentication → Sign In / Providers → Email: turn **off** "Confirm email" (demo).
3. `cp .env.example .env` and fill Supabase keys. `cp apps/web/.env.example apps/web/.env.local` and fill.
4. Fill `config/archetypes.json`, run `pnpm --filter @pseudo/api seed:archetypes`. Then `pnpm --filter @pseudo/api seed` → demo login `demo@pseudo.app / pseudo-demo-2026` with Alex Sterling.
5. `pnpm dev` → web http://localhost:3000, api http://localhost:4000/health.
6. Real research (optional): `pnpm --filter @pseudo/research setup:ytdlp` once, set `RESEARCH_SOURCE=apify`, `RESEARCH_WATCHER=vision` + keys (see `docs/ENVIRONMENT.md`), then check one creator with `pnpm --filter @pseudo/api research:smoke --archetype trader --influencer trader-1`.

## Deploy
- **API → Render:** New → Blueprint → this repo (`render.yaml`). Fill env vars. Note the URL.
- **Web → Vercel:** Import repo, Root Directory `apps/web`, framework Next.js. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL=<render url>`.
- Add the Vercel URL to Render `CORS_ORIGINS`, and to Supabase Auth → URL Configuration.
