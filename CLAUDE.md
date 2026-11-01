# PSEUDO — instructions for Claude Code (read before every change)

PSEUDO: AI studio where the user creates an alter ego and generates content of **themselves** LARPing as it.
The user uploads their own selfies; generated images use them as reference so the persona's face = the user's face.
Tagline: **"Your alter ego."** Hackathon build: demo is the priority. Docs are in `docs/` (short on purpose).

## Golden rules
1. **TypeScript everywhere.** No Python. pnpm + Turborepo monorepo.
2. **Contracts live in `packages/shared`** (Zod schemas, enums, API request/response). Never redefine an API shape in apps. Changes to shared must be **additive** — tell the team in chat before changing/removing anything.
3. **Persona context goes into every AI call** via `personaContext()` in `packages/ai/src/prompts.ts`. Safety rules (`SAFETY_RULES`) go into every prompt.
4. **Validate all AI output with Zod before writing to the DB** (`generateJson` does this).
5. **Nothing publishes without explicit approval.** `content_items.approved_at` must be set by `POST /api/content/:id/approve`; a DB trigger blocks publishing jobs otherwise. Editing approved content resets it to `awaiting_approval`.
6. **Mock mode is first-class.** Every provider (text/image/voice/publishing) has a mock. The whole demo must work with zero API keys. Don't break mock mode.
7. **Secrets are server-only.** `apps/web` only knows the Supabase anon key + API URL. OAuth tokens live in `social_account_tokens` (no RLS policies = service role only), AES-GCM encrypted.
8. **Label AI content.** Generated media shows `<AiBadge/>`; sample analytics show `<SampleDataBadge/>`; never fabricate returns/earnings/credentials/testimonials.
9. Long work runs in the background via `createRun` + `runInBackground` (apps/api/src/lib/runs.ts) and reports progress over SSE. Routes return `{ runId }` with 202.

## Layout
```
apps/web        Next.js 16 App Router, Tailwind v4, TanStack Query, Zustand  (Vercel)
apps/api        Fastify 5 REST + SSE + background jobs + publishing worker   (Render)
packages/shared     Zod schemas, enums, API contracts, safety rules
packages/database   Supabase clients (admin / per-user RLS) + row->API mappers
packages/ai         Providers: text (OpenAI SDK, any compatible endpoint), image (Gemini/OpenAI), voice (ElevenLabs), mocks, prompts
packages/agents     LangGraph.js workflows: Persona, Strategy+Content, Visual prompt
packages/media      Remotion composition (ShortVideo) used by the web <Player>
packages/publishers Publisher interface, platform validation, mock + live adapters
supabase/migrations SQL schema + RLS
```

## Conventions
- DB is snake_case, API is camelCase: always map rows with `packages/database/src/mappers.ts`.
- API routes use `req.db` (user JWT client → RLS). Background jobs use `getAdminClient()` and must filter by `user_id` themselves.
- Validate route input with `parse(Schema, req.body)`; throw `HttpError` for 4xx.
- Web: data via `api.*` in `apps/web/lib/api.ts` + TanStack Query keys `['personas']`, `['content', ...]`, `['media', ...]`, `['runs']`, `['analytics']`, `['publishing']`. SSE (`useLiveEvents`) invalidates these — don't poll.
- UI: dark-first, tokens in `apps/web/app/globals.css` (`bg-surface`, `border-border`, `text-muted`, `text-gradient`, accent violet→cyan). Reuse `components/ui/*`.
- Workspace packages export TS source (no build step). API runs with `tsx`.

## Commands
```
pnpm install
pnpm dev            # web :3000 + api :4000
pnpm typecheck
pnpm --filter @pseudo/api seed   # demo user + Alex Sterling + sample analytics
```

## Team ownership (avoid stepping on each other — see docs/IMPLEMENTATION_PLAN.md)
- **A — Brain:** `apps/api/src/routes`, `apps/api/src/jobs/{persona,content}.ts`, `packages/agents`, `packages/ai/src/{text,prompts}.ts`, `supabase/`, Render deploy.
- **B — Face:** `apps/web` core pages: Command Center, Persona Studio, Proof of Life, Content Studio, `components/`. Vercel deploy.
- **C — Body:** images/video/voice/publishing: `packages/{media,publishers}`, `packages/ai/src/{image,voice}.ts`, `apps/api/src/jobs/{image,video,publisher}.ts`, web pages Media, Video, Analytics, Settings.

Everyone commits to `dev`: `git pull --rebase origin dev` before every push, small commits, stay inside your folders.
