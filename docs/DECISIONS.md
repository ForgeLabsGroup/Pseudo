# Decisions (ADRs, short)

- **ADR-001 TypeScript monorepo, source-only packages.** Packages export `.ts`; Next `transpilePackages`, API runs on `tsx`. No build step = faster hackathon iteration.
- **ADR-002 Persona = the user's own face.** Users upload selfies; images use them as references (Gemini Flash Image / gpt-image-1 edits). No other real person's likeness.
- **ADR-003 In-process jobs instead of Inngest (for now).** Render runs one API instance; `runInBackground` + `agent_runs` gives tracking/SSE, publishing queue is DB-backed with retries + idempotent claim. Deviation from spec to cut infra for a 5-hour build. Swap in Inngest functions behind the same job functions later.
- **ADR-004 Single API service on Render (no separate worker).** Publishing worker runs inside the API process. Split into its own service when scaling.
- **ADR-005 OpenAI SDK against any OpenAI-compatible endpoint.** Lets us use Gemini's free tier for text with the same code. Structured output via JSON mode + Zod validation (portable across providers).
- **ADR-006 Free image model default = Gemini 2.5 Flash Image** (reference-image support, free tier via AI Studio key). Video = template (Remotion), not generative video (no reliable free API).
- **ADR-007 Client-side auth in web.** Supabase JS session in browser, token sent to API; API verifies with `auth.getUser`. Simpler than SSR cookies for an all-client dashboard.
- **ADR-008 Public-read media bucket.** Unguessable paths, server-only writes; avoids signed-URL plumbing. Revisit for production.
- **ADR-009 Mock publishing is first-class.** Same interface/validation as live; demo never depends on platform approvals.
