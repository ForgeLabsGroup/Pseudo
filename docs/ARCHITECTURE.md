# Architecture

```
Browser (Next.js, Vercel)
  │  Supabase Auth (anon key) → access token
  │  REST + SSE  (Authorization: Bearer <token>, SSE uses ?access_token=)
  ▼
Fastify API (Render, single instance)
  ├─ routes/*        validate with @pseudo/shared Zod → req.db (RLS-scoped Supabase client)
  ├─ lib/runs        agent_runs + agent_events + SSE bus (in-process EventEmitter)
  ├─ jobs/*          persona, content, image, video  → @pseudo/agents (LangGraph) → @pseudo/ai providers
  └─ jobs/publisher  polls publishing_jobs every 3s → @pseudo/publishers (mock | live) → records
  ▼
Supabase: Postgres (+RLS) · Auth · Storage bucket "media" (public read, server writes)
External (optional): OpenAI-compatible LLM (OpenAI / Gemini), Gemini/OpenAI images, ElevenLabs
```

**Flows**
- *Persona:* POST /personas → row(status=generating) + run → Persona graph (draft → review) → Zod → persona_versions v1 → SSE persona.updated.
- *Content:* POST /content/generate → N placeholder items (generating) → Strategy (angles) → Content (one per item) → finalize (AI tag) → items awaiting_approval → Instagram: Visual Agent prompt → image w/ selfies → content_media.
- *Video:* POST /media/videos/generate → per-scene 9:16 images + ElevenLabs voiceover → web previews with Remotion `<Player>`.
- *Publish:* approve → POST /publishing/:id/publish|schedule → validate platform rules → publishing_jobs (DB trigger requires approval; unique active job) → worker → publisher → publishing_records → content published/failed (3 attempts, exp. backoff).
