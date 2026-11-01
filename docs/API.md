# API

Base: `NEXT_PUBLIC_API_URL`. All `/api/*` need `Authorization: Bearer <supabase access token>`.
Schemas: `packages/shared/src/api.ts` (the contract). Background endpoints return **202 `{ runId }`**; progress via SSE.
CORS allows GET, HEAD, POST, PATCH, DELETE (`apps/api/src/server.ts`); a route using any other method must be added there or browsers block it.

| Method | Path | Body / Query → Response |
|---|---|---|
| GET | /health | `{ ok }` (no auth) |
| GET | /api/auth/session | `SessionResponse` (user + aiMode/publishMode) |
| GET | /api/personas | `ListPersonasResponse` |
| POST | /api/personas | `CreatePersonaRequest` (`description`, `archetypeId?`) → `{ persona, runId }` |
| GET | /api/personas/:id | `{ persona, versions }` |
| PATCH | /api/personas/:id | `UpdatePersonaRequest` (creates new version) → `{ persona }` |
| DELETE | /api/personas/:id | 204. Cascades versions, content, campaigns; also deletes the persona's media assets (incl. selfies) and their Storage files |
| POST | /api/personas/:id/generate | `{ instructions? }` → `{ runId }` |
| POST | /api/personas/:id/character | `{ provider: 'higgsfield' }` → `{ runId }` (train likeness from selfies) |
| POST | /api/personas/:id/reference-photos | multipart `file` (selfie) → `{ asset }` |
| GET | /api/content | `ListContentQuery` → `{ items }` |
| POST | /api/content | manual `{ personaId, platform, body }` → `{ item }` |
| POST | /api/content/generate | `GenerateContentRequest` → `{ runId, contentIds }` |
| GET/PATCH | /api/content/:id | `UpdateContentRequest` → `{ item }` |
| POST | /api/content/:id/approve | `{ approved }` → `{ item }` |
| POST | /api/content/:id/regenerate | `{ instructions? }` → `{ runId }` |
| GET | /api/media | `ListMediaQuery` → `{ assets }` |
| PATCH | /api/media/:id | `{ isFavorite?, category? }` → `{ asset }` |
| DELETE | /api/media/:id | 204. Deletes the row and Storage file; nulls the persona avatar if it was this asset, detaches it from content, clears `videoAssetId`/`voiceoverAssetId` in short_video bodies (approved content goes back to `awaiting_approval`) |
| POST | /api/media/:id/set-avatar | sets persona avatar |
| POST | /api/media/images/generate | `GenerateImageRequest` → `{ runId }` |
| POST | /api/media/videos/generate | `GenerateVideoRequest` → `{ runId }` |
| GET/POST | /api/campaigns, GET /api/campaigns/:id | minimal |
| GET | /api/social-accounts | `{ accounts }` |
| POST | /api/social-accounts/:platform/connect | `{ mode: 'mock', handle }` → `{ account, authorizeUrl }` |
| DELETE | /api/social-accounts/:id | 204 |
| GET | /api/publishing | `{ jobs, records }` |
| POST | /api/publishing/:contentId/publish | `{ socialAccountId? }` → `{ job }` (409 if not approved, 422 if platform rules fail) |
| POST | /api/publishing/:contentId/schedule | `{ runAt, socialAccountId? }` → `{ job }` |
| POST | /api/publishing/jobs/:id/cancel | cancel queued job |
| GET | /api/archetypes | `{ archetypes }` (with `playbookUpdatedAt`) |
| GET | /api/archetypes/:id | `{ archetype, playbook }` |
| POST | /api/archetypes/:id/research | `{ force }` → `{ runId }` (refresh research playbook) |
| GET | /api/analytics | `DashboardResponse` |
| GET | /api/usage/higgsfield | `HiggsfieldUsageResponse` (paid Higgsfield requests from `provider_usage`) |
| GET | /api/agents/runs, /api/agents/runs/:id | runs + events |
| GET | /api/events?access_token= | **SSE** stream of `LiveEvent` |
