# Risks

| Risk | Mitigation |
|---|---|
| AI provider down/slow/quota during demo | Mock mode for every provider; seeded Alex Sterling; pre-generate demo content before going on stage |
| Gemini free-tier limits/safety blocks on images | Fallback `AI_IMAGE_PROVIDER=openai` or `mock`; keep 3–4 good images pre-generated |
| Face likeness inconsistent | Use 2–3 clear, well-lit selfies; don't promise perfect consistency |
| Render free plan cold start | Use a paid instance or ping /health before the demo |
| In-memory SSE bus lost on restart | UI also refetches via TanStack Query; runs are persisted in DB |
| Social APIs need app review | Mock publishing for demo; live adapters are Phase 10 |
| Three people on one branch | Folder ownership (CLAUDE.md), additive-only changes to `packages/shared`, `pull --rebase` often |
| LLM returns invalid JSON | Zod validation + 1 repair attempt; failures visible as `failed` runs |
