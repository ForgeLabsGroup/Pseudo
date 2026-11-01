# Tech stack

| Layer | Choice |
|---|---|
| Web | Next.js 16 (App Router), React 19, Tailwind v4, shadcn-style components (`components/ui`), TanStack Query, Zustand, lucide icons, Geist |
| API | Node 22, Fastify 5, Zod 4, SSE, `tsx` runtime |
| AI orchestration | LangGraph.js (`@langchain/langgraph`) |
| LLM | Official `openai` SDK against any OpenAI-compatible endpoint (OpenAI or Gemini free tier via `OPENAI_BASE_URL`) |
| Images | Gemini 2.5 Flash Image (`@google/genai`, accepts reference selfies) · OpenAI gpt-image-1 · mock SVG |
| Voice | ElevenLabs (REST, with word timestamps) |
| Video | Remotion (`@pseudo/media` composition, `@remotion/player` preview). Server render + FFmpeg = stretch |
| Data | Supabase Postgres + RLS, Auth, Storage |
| Background jobs | In-process runner + DB-backed publishing queue (see ADR-003; Inngest deferred) |
| Tooling | pnpm workspaces, Turborepo, Vitest, Prettier |
| Deploy | Vercel (web), Render (api), Supabase |
