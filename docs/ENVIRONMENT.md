# Environment

See `.env.example` (root, used by the API) and `apps/web/.env.example` (copy to `apps/web/.env.local`).

- Supabase keys: Project Settings → API. **Service role key only in the API** (Render env), never `NEXT_PUBLIC_*`.
- `CORS_ORIGINS` must include the Vercel URL in prod.
- AI: everything defaults to `mock`. Free setup with one Google AI Studio key:
  - `AI_TEXT_PROVIDER=openai`, `OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`, `OPENAI_API_KEY=<gemini key>`, `OPENAI_MODEL=gemini-2.5-flash`
  - `AI_IMAGE_PROVIDER=gemini`, `GEMINI_API_KEY=<gemini key>`
- Higgsfield (likeness + video): `AI_IMAGE_PROVIDER=higgsfield`, `AI_VIDEO_PROVIDER=higgsfield`, `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_SECRET`, `HIGGSFIELD_BASE_URL`.
- Voice: `AI_VOICE_PROVIDER=elevenlabs`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
- Research (all default to `mock`): `RESEARCH_SOURCE=apify` + `APIFY_TOKEN`. Video understanding: `RESEARCH_WATCHER=vision` with `FEATHERLESS_API_KEY` and `VIDEO_MODEL_NAME` (must be an **image-input** model, e.g. `google/gemma-3-27b-it`; the model is chosen per request by this name). Any OpenAI-compatible vision endpoint works via `VIDEO_MODEL_BASE_URL` + `VIDEO_MODEL_API_KEY`. Spoken words: `TRANSCRIBE_PROVIDER=openai|groq` (+ key), default `none`. Downloads fall back to yt-dlp (`pnpm --filter @pseudo/research setup:ytdlp`); ffmpeg is bundled. `RESEARCH_WATCHER=gemini` still works with `GEMINI_API_KEY`.
- `TOKEN_ENCRYPTION_KEY`: `openssl rand -base64 32` (only needed for live OAuth).
