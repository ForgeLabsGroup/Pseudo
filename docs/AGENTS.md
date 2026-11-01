# AI agents

Flow (matches the whiteboard): Dash → backend orchestrator → Persona → Content [Research → Ideation(Strategy) → Writing → Visual] → **user approval** → Publish → Dash.

Controlled workflows, typed I/O (Zod), no free-form agent chatter. All prompts include `personaContext()` + `SAFETY_BLOCK`.
Every run is an `agent_runs` row with step events (`progress(step, message)`) streamed over SSE.
Every provider call (LLM, image, voice, video, scraper, watcher, publisher) is wrapped in `traced()` (`packages/ai/src/trace.ts`) and streamed as `call.started` / `call.finished` (who, module, ms, ok) for the home page Core graph; the run context comes from `AsyncLocalStorage` in `apps/api/src/lib/trace.ts`.

| Agent | Where | Input → Output | Failure |
|---|---|---|---|
| Research | `packages/research` + `apps/api/src/jobs/research.ts` | archetype influencers → Apify (latest 3 videos + X posts each) → Gemini watches each video → `ArchetypePlaybook` | per-video/per-platform failures skipped; falls back to previous playbook; 24h cache |
| Persona | `packages/agents/src/persona.ts` (graph: draft → review) | description, existing?, instructions? → `PersonaIdentity` | 1 repair retry on invalid JSON; persona → `failed` |
| Strategy | `content.ts` node `plan` | identity, platform, count, topic → angles[] (pillar + angle) | run fails, placeholders → `failed` |
| Content | `content.ts` node `write` (+ `finalize` adds #AIgenerated) | identity + angle + platform rules → `ContentBody` | same |
| Visual | `visual.ts` + `apps/api/src/jobs/image.ts` | identity, category, scene → prompt → image (with user selfies) | content kept, image error logged |
| Video | `apps/api/src/jobs/video.ts` | short_video script → scene images + ElevenLabs voice | item back to awaiting_approval with error |
| Distribution | `packages/publishers` + `jobs/publisher.ts` | approved content → validate → publish → record | 3 attempts, exp. backoff; never bypasses approval |
| Analytics | (later) | snapshots → summary/recommendations | — |

Providers (`packages/ai`): `generateJson` (OpenAI SDK, JSON mode + schema-in-prompt + Zod + 1 repair), `generateImage`, `generateVoice`. `*_PROVIDER=mock` returns Alex Sterling fixtures.
