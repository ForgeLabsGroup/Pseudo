# Who does what (simple version)

Everyone: pull `dev`, run `pnpm install`, then `pnpm dev`. Work in **your folders only**.
Before every push: `git pull --rebase origin dev`. Push small and often.
Ask Claude Code to "read CLAUDE.md and docs/ROLES.md, I am Person X" at the start of your session.

**Everything already works in mock mode.** Your job is to make your part real and good-looking.

---

## Person A: "Brain" (data, research, AI writing)

**You own:** `packages/research`, `packages/agents`, `packages/ai/src/text.ts` + `prompts.ts`, `apps/api/src/routes`, `apps/api/src/jobs/{persona,content,research}.ts`, `supabase/`, `config/archetypes.json`.

Do these in order:
1. **Set up Supabase (first 20 min, everyone is waiting on this).**
   Create the project → SQL Editor → run the 3 files in `supabase/migrations/` in order → turn off "Confirm email" → fill `.env` → run `pnpm --filter @pseudo/api seed`. Send the keys to the team.
2. **Fill in the influencers.** Put the 3 handles × 3 archetypes into `config/archetypes.json`, then run `pnpm --filter @pseudo/api seed:archetypes`.
3. **Make Apify work.** Get an Apify token. Open `packages/research/src/sources/apify.ts` and check each scraper's input and output fields on its Apify page (the TODOs). Test with ONE trader influencer first.
   *Done when:* you get 3 real videos and some X posts back.
4. **Make Gemini watch the videos.** Set `RESEARCH_SOURCE=apify`, `RESEARCH_WATCHER=gemini`, `GEMINI_API_KEY`. Hit "research" for Trader (`POST /api/archetypes/:id/research`).
   *Done when:* the Trader playbook looks smart and contains no names or copied lines.
5. **Make the writing great.** Turn on the real text model (`AI_TEXT_PROVIDER=openai`, see `docs/ENVIRONMENT.md`). Generate a persona + Instagram, X and TikTok content for Trader, then tune the prompts in `packages/agents` until it sounds like a real creator.
6. Research E-commerce and Fitness Coach. Write a couple of quick tests if you have time.

## Person B: "Face" (the app people click)

**You own:** `apps/web/app/(app)/{page.tsx,personas,studio,content,settings}`, `apps/web/app/(auth)`, `apps/web/components/` (not `video-preview.tsx`).
Data comes from `api.*` in `apps/web/lib/api.ts`. Live updates arrive automatically (SSE), so don't poll.

Do these in order:
1. **New persona** (`/personas/new`):
   - Pick an archetype (`api.archetypes.list`).
   - Type a description.
   - Upload 3–6 selfies (`api.personas.uploadReference`).
   - Create (`api.personas.create({ description, archetypeId })`).
   - Show live progress, then go to the persona page.
2. **Persona page** (`/personas/[id]`): show the identity nicely (bio, personality, voice, pillars, look, social bios). Add:
   - Edit, which creates a new version (`api.personas.update`), and a versions list.
   - A "Lock my likeness" button (`api.personas.trainCharacter`) showing its status (`persona.characterRefs.higgsfield`).
   - A "Generate photo" button and a photo gallery.
3. **Proof of Life** (`/studio`):
   - A form: persona, platform, type, topic, tone, count → `api.content.generate`.
   - Live steps: Research → Ideas → Writing → Visual.
4. **Content Studio** (`/content`):
   - Cards that look like real posts (an Instagram post, an X post or thread, a TikTok script).
   - Filters, edit, **Approve / Reject**, **Publish now (mock)**, and Schedule.
   - *Done when:* approve → publish → the card turns "published" with a link, live.
5. **Command Center** (`/`) polish: the approval queue, recent publishes, the live agent feed, and nice empty and loading states.
6. **Settings** (`/settings`): connect mock accounts (`api.socialAccounts.connect`) and show the AI/publish mode.

## Person C: "Body" (photos, videos, shipping it)

**You own:** `packages/{media,publishers}`, `packages/ai/src/{image,voice,video,higgsfield}.ts`, `apps/api/src/jobs/{image,video,character,publisher}.ts`, `apps/web/app/(app)/{media,video,analytics}`, `apps/web/components/video-preview.tsx`, `render.yaml`, deploys.

Do these in order:
1. **Make Higgsfield work.** All the TODOs are in `packages/ai/src/higgsfield.ts`; use docs.higgsfield.ai.
   - Train a likeness from selfies.
   - Generate a photo of that person.
   - Turn a photo into a 5-second video.
   *Done when:* a generated photo clearly looks like the selfie person in 4 out of 5 tries.
   Compare against Gemini's Pro image model and pick the best.
2. **Videos.** Turn on ElevenLabs. The "Build video" flow (`api.media.generateVideo`) makes scene photos → animated clips → voiceover.
   Build `/video`: pick a TikTok script → build → watch it in `<VideoPreview>` → approve.
3. **Media Library** (`/media`): a grid of all photos, clips and audio, with filters, favorite, "set as avatar", an "AI-generated" badge, and a "selfie" tag on uploads.
4. **Analytics** (`/analytics`): a chart from `api.analytics()`, always showing the **Sample data** badge when it's fake.
5. **Ship it.**
   - API on Render (`render.yaml`), web on Vercel (root `apps/web`).
   - Set the env vars, and add the Vercel URL to `CORS_ORIGINS` and to Supabase Auth URLs.
   - *Done when:* the full demo works on the live URLs.

---

## Timeline
| When | What |
|---|---|
| First 20 min | A sets up Supabase; B and C run the app in mock mode |
| +45 min | A: Apify works for 1 trader. C: likeness test result shared |
| +2h 30m | Whole demo works locally |
| +3h 15m | **Stop adding features.** Deployed. Real AI turned on |
| Last hour | Fix bugs on the live site, pre-generate demo content, rehearse twice |

## Rules for everyone
- Need a new field or endpoint? Add it to `packages/shared` (only add, never rename or delete) and tell the team.
- Never break mock mode. It's our backup on stage.
- Nothing publishes without the Approve button.
- No fake money, results, credentials or testimonials. Generated media always shows the AI badge.
