# Development setup

1. Node 22+, pnpm 10 (`corepack enable`). `pnpm install`.
2. **Supabase** (one person does this, shares keys):
   - Create project → SQL Editor → paste `supabase/migrations/20261101000000_init.sql` → Run.
     (or `npx supabase link --project-ref <ref> && npx supabase db push`)
   - Also run `supabase/migrations/20261101010000_character_refs.sql`.
   - Authentication → Sign In / Providers → Email: turn **off** "Confirm email" (demo).
3. `cp .env.example .env` and fill Supabase keys. `cp apps/web/.env.example apps/web/.env.local` and fill.
4. `pnpm --filter @pseudo/api seed` → demo login `demo@pseudo.app / pseudo-demo-2026` with Alex Sterling.
5. `pnpm dev` → web http://localhost:3000, api http://localhost:4000/health.

## Deploy
- **API → Render:** New → Blueprint → this repo (`render.yaml`). Fill env vars. Note the URL.
- **Web → Vercel:** Import repo, Root Directory `apps/web`, framework Next.js. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL=<render url>`.
- Add the Vercel URL to Render `CORS_ORIGINS`, and to Supabase Auth → URL Configuration.
