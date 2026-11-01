# AI agents

Controlled workflows, typed I/O (Zod), no free-form agent chatter. All prompts include `personaContext()` + `SAFETY_BLOCK`.
Every run is an `agent_runs` row with step events (`progress(step, message)`) streamed over SSE.

| Agent | Where | Input → Output | Failure |
|---|---|---|---|
| Persona | `packages/agents/src/persona.ts` (graph: draft → review) | description, existing?, instructions? → `PersonaIdentity` | 1 repair retry on invalid JSON; persona → `failed` |
| Strategy | `content.ts` node `plan` | identity, platform, count, topic → angles[] (pillar + angle) | run fails, placeholders → `failed` |
| Content | `content.ts` node `write` (+ `finalize` adds #AIgenerated) | identity + angle + platform rules → `ContentBody` | same |
| Visual | `visual.ts` + `apps/api/src/jobs/image.ts` | identity, category, scene → prompt → image (with user selfies) | content kept, image error logged |
| Video | `apps/api/src/jobs/video.ts` | short_video script → scene images + ElevenLabs voice | item back to awaiting_approval with error |
| Distribution | `packages/publishers` + `jobs/publisher.ts` | approved content → validate → publish → record | 3 attempts, exp. backoff; never bypasses approval |
| Analytics | (later) | snapshots → summary/recommendations | — |

Providers (`packages/ai`): `generateJson` (OpenAI SDK, JSON mode + schema-in-prompt + Zod + 1 repair), `generateImage`, `generateVoice`. `*_PROVIDER=mock` returns Alex Sterling fixtures.
