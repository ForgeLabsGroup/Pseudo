# Implementation plan

> **Current roles and tasks: see [`ROLES.md`](ROLES.md)** (simple version, supersedes the per-person sections below where they differ — Research is owned by A, Settings by B, deploys by C).


## Done (foundation, already on `dev`)
Monorepo, shared Zod contracts, full DB schema + RLS (validated), Supabase clients/mappers, AI providers (text/image/voice + mocks),
LangGraph Persona + Strategy/Content graphs, Visual prompt, **complete Fastify API** (all routes, SSE, runs, jobs, publishing worker w/ retries),
Remotion `ShortVideo` + `<VideoPreview>`, mock/live publisher interface, web shell (auth, sidebar, typed API client, SSE hook,
UI primitives, Command Center v1, page stubs). Mock mode works end-to-end on the API side.

## Timeline (T = start)
| Time | Milestone |
|---|---|
| T+0:00–0:20 | A: Supabase project + migration + seed, shares `.env`. Everyone: `pnpm install`, `pnpm dev`, log in as demo user |
| T+2:30 | **Demo path works locally in mock mode** (all three streams merged) |
| T+3:15 | **Feature freeze.** Deployed to Vercel + Render. Real providers switched on |
| T+3:15–4:15 | Bug bash on the deployed demo path only. Pre-generate demo content |
| T+4:15–5:00 | Rehearse the demo twice. Keep a mock-mode backup ready |

## Person A — "Brain" (backend, AI, infra)
Owns: `apps/api/src/routes`, `apps/api/src/jobs/{persona,content}.ts`, `packages/agents`, `packages/ai/src/{text,prompts,mock/text}.ts`, `supabase/`, `render.yaml`.
1. **Supabase setup** (T+0:20): migration, email confirmation off, seed, share keys.
   ✅ demo user logs in; `GET /api/personas` returns Alex Sterling.
2. **Real LLM** (Gemini key via OpenAI-compat endpoint or OpenAI): persona + content generation with real text.
   ✅ "Miami crypto trader" description → valid identity in < 30s; 3 content types validate; no P&L numbers / financial advice in output.
3. **Prompt quality pass**: tone matches style guide; X posts < 240 chars; IG captions punchy; scripts 15–30s.
4. **Batch "week of content"** (should-have): `POST /api/content/generate-batch` → IG ×2, X ×3, TikTok ×1 in one run (add the request schema to shared, additive).
   ✅ one click creates 6 items across platforms.
5. **Deploy API to Render** + CORS for Vercel URL. ✅ `/health` OK from Vercel origin; SSE stays connected.
6. Tests (Vitest): agents in mock mode, `validateForPlatform`, approval rules.

## Person B — "Face" (core web flows)
Owns: `apps/web/app/(app)/{page.tsx,personas,studio,content}`, `apps/web/app/(auth)`, `apps/web/components/` (except video-preview).
1. **Persona Studio** `/personas`, `/personas/new`: description → create → **selfie upload step** (`api.personas.uploadReference`, 1–3 photos) → detail page with live generation progress (SSE activity filtered by runId).
   ✅ new persona appears with full identity without refresh.
2. **Persona detail** `/personas/[id]`: "Lock my likeness" button after selfies (`api.personas.trainCharacter`) with training status from `persona.characterRefs.higgsfield`; identity sections (bio, personality, style guide, pillars, visual identity, social bios), inline edit → `api.personas.update` (shows new version), versions list, "Generate image" button (`api.media.generateImage`) + gallery of this persona's images, "set as avatar".
3. **Proof of Life Studio** `/studio`: persona, platform, content type (filtered by `PLATFORM_CONTENT_TYPES`), topic, tone, count → `api.content.generate`; placeholders flip from *generating* to previews live.
4. **Content Studio** `/content`: grid/list, filters (persona/platform/status), **platform-native previews** (IG card with image + caption, X post/thread, TikTok script scenes), edit caption/script, approve/reject, **Publish now (mock)**, schedule (datetime), status badges, publish result link.
   ✅ approve → publish → status goes publishing → published live; record shows mock URL.
5. **Command Center polish**: stats, awaiting-approval queue with quick approve, publishing activity, live agent feed, empty/loading states.
6. **Deploy web to Vercel.**

## Person C — "Body" (media, video, publishing, data)
Owns: `packages/{media,publishers}`, `packages/ai/src/{image,voice,mock/image}.ts`, `apps/api/src/jobs/{image,video,publisher}.ts`, `apps/web/app/(app)/{media,video,analytics,settings}`, `apps/web/components/video-preview.tsx`.
0. **Wire Higgsfield** in `packages/ai/src/higgsfield.ts` (only file with TODOs): `createCharacter`/`getCharacter` (Soul ID from selfie URLs), `higgsfieldImage` (character + scene prompt), `higgsfieldImageToVideo` (still → 5s vertical clip). Docs: docs.higgsfield.ai. Everything else (DB column, train route, video job, player) is already plumbed.
1. **Likeness bake-off first (by T+0:45).** Same 4–6 selfies, same 3 scenes (balcony, trading desk, marina) on: **Higgsfield Soul ID**, Gemini Pro image model (paid), Gemini Flash (free). Pick the winner by eye with the whole team; set `GEMINI_IMAGE_MODEL` / add a provider in `packages/ai/src/image.ts`. Selfie tips: 4–6 photos, varied angles, good light, no sunglasses.
   ✅ generated photos are recognisably the user in ≥ 4 of 5 attempts; Miami aesthetic consistent.
2. **Media Library** `/media`: grid, filters (persona/kind/category), favorite, set avatar, open/download, `AiBadge` on generated, "reference" tag on selfies, generate-image dialog.
3. **Video Studio** `/video`: list `short_video` items → "Build video" (`api.media.generateVideo`: scene stills → Higgsfield clips → ElevenLabs voice) → `<VideoPreview>` with clips + captions + audio; approve from here.
   ✅ TikTok script → playable 9:16 preview of the user moving in each scene, with voiceover.
4. **Settings** `/settings`: profile, connected accounts (mock connect per platform with handle = persona handle), shows AI/publish mode from `api.session()`.
5. **Analytics** `/analytics`: engagement chart from `api.analytics()` with **SampleDataBadge**, platform breakdown, publish success/fail counts.
6. Stretch: subtitle word timings from ElevenLabs into the composition; server MP4 render; live X publishing via OAuth2.

## Integration contract between streams
- B and C only call `api.*` in `apps/web/lib/api.ts`. If an endpoint is missing, A adds it (C may add media/publishing endpoints in its own route files).
- New fields → add to `packages/shared` (additive), post in team chat.
- SSE events drive UI refresh; no polling.

## Demo checklist (T+4:15)
- [ ] Demo account seeded; Alex has 2–3 selfies + 4 good generated images
- [ ] One fresh persona creation works live (or have it pre-created as fallback)
- [ ] IG post with image, X post, TikTok script + video preview generated
- [ ] Approve → mock publish → Command Center shows it published
- [ ] Mock-mode fallback env ready on Render (flip `AI_*_PROVIDER=mock`)
