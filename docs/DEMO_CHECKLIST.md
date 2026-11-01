# Demo checklist

Tick items as they are verified on the **deployed** URLs, not just locally.
Status as of 2026-11-01: `[x]` = done and verified, `[ ]` = still open.

## 1. Backend + auth (Supabase)
- [x] Supabase project created; the 3 migrations in `supabase/migrations/` applied
- [x] "Confirm email" off (signups get a session straight away)
- [x] Storage buckets `media` and `research-videos` exist
- [x] `pnpm --filter @pseudo/api seed` run: demo user (`DEMO_EMAIL` / `DEMO_PASSWORD` in `.env`), Alex Sterling, sample analytics
- [x] `pnpm --filter @pseudo/api seed:archetypes` run: Trader, E-commerce Founder, Fitness Coach
- [ ] Supabase → Authentication → URL Configuration: Site URL = Vercel URL, Vercel URL added to Redirect URLs
- [ ] Demo login works on the deployed web URL

## 2. Real providers (flip from `mock` once each one passes)
- [ ] Text: `AI_TEXT_PROVIDER=openai`, persona + IG/X/TikTok content generated and prompts tuned
- [ ] Images: likeness bake-off done (Higgsfield Soul ID vs Gemini Pro image), winner set in `AI_IMAGE_PROVIDER`
- [ ] Higgsfield wired in `packages/ai/src/higgsfield.ts` (train likeness, image, image → video)
- [ ] Voice: `ELEVENLABS_API_KEY` set, `AI_VOICE_PROVIDER=elevenlabs`
- [ ] Research: influencer handles filled in `config/archetypes.json`, Apify fields confirmed, Trader playbook generated with Gemini
- [x] Publishing stays `PUBLISH_MODE=mock` (live adapters are out of scope for the demo)

## 3. Web pages
- [x] Login / signup
- [x] Command Center (`/`)
- [x] Personas list, new-persona wizard, persona page (identity, edit + versions, likeness, photos)
- [x] Proof of Life (`/studio`)
- [x] Content Studio (`/content`): approve / reject / publish now (mock) / schedule
- [x] Settings (`/settings`)
- [ ] A2 restyle merged into `dev` (PR #2)
- [ ] Media Library (`/media`), currently a placeholder
- [ ] Video Studio (`/video`), currently a placeholder
- [ ] Analytics (`/analytics`) with the Sample data badge, currently a placeholder

## 4. Deploy
- [ ] API on Render (`render.yaml`), all env vars set, `/health` OK
- [ ] Web on Vercel (root `apps/web`), `NEXT_PUBLIC_*` vars set
- [ ] Vercel URL added to `CORS_ORIGINS` on Render
- [ ] SSE stays connected from the Vercel origin (live run progress shows)
- [ ] `/health` pinged right before going on stage (Render cold start)

## 5. Pre-generated demo content
- [ ] Alex has 2–3 selfies + 4 good generated images
- [ ] One IG post with image, one X post, one TikTok script
- [ ] One TikTok video preview built (scene clips + voiceover)
- [ ] At least one item left in "awaiting approval" for the live approve → publish moment

## 6. Demo run (rehearse twice)
1. [ ] Log in as the demo user → Command Center shows Alex, the approval queue and recent publishes
2. [ ] Create a fresh persona live: archetype → basics (name, age, location…) → description → 3–20 selfies → live progress → persona page
   (fallback: open the pre-created one)
3. [ ] Lock likeness → generate a photo that looks like the selfie person
4. [ ] Proof of Life: generate IG + X + TikTok content, steps tick through Research → Ideas → Writing → Visual
5. [ ] Content Studio: edit a caption, **Approve**, **Publish now (mock)**, card flips to published with a link, live
6. [ ] Video Studio: build the TikTok video, play it in the preview
7. [ ] Analytics: chart with the **Sample data** badge visible
8. [ ] AI badge visible on every generated image and video

## 7. Fallbacks (have ready before going on stage)
- [ ] Mock-mode env ready on Render: flip `AI_*_PROVIDER=mock` and redeploy if a provider fails
- [ ] Local `pnpm dev` running in mock mode on a laptop as a last resort
- [ ] Pre-generated content covers every step, so nothing has to be generated live
