# Database

Source of truth: `supabase/migrations/20261101000000_init.sql`. Every user-owned table has `user_id` and the RLS policy `user_id = auth.uid()`.

| Table | Notes |
|---|---|
| users | profile, auto-created by trigger on `auth.users` insert |
| personas | `identity jsonb` = `PersonaIdentity`; `current_version`; `avatar_asset_id` |
| persona_versions | append-only identity history (unique persona_id+version) |
| social_accounts | platform, handle, mode mock/live (no tokens) |
| social_account_tokens | encrypted OAuth tokens. RLS on, **no policies** → service role only |
| campaigns | optional grouping + Strategy output |
| agent_runs / agent_events | every AI workflow run + step log (traceability) |
| content_items | platform, content_type, status, `body jsonb` = `ContentBody`, approved_at, persona_version |
| media_assets | image/video/audio; source reference_upload / ai_generated / rendered; `ai_generated` generated column |
| content_media | content↔asset with role (primary/scene/voiceover/video) + position |
| publishing_jobs | queue; trigger requires approved content; partial unique index = one active job per content |
| publishing_records | each attempt's result (external id/url or error) |
| analytics_snapshots | per day/platform; `is_sample` must be labelled in UI |

Storage: bucket `media` (public read), path `{user_id}/{persona_id}/{uuid}.{ext}`, written only by the API (service role).
Validated locally with PGlite (approval trigger, unique job index, profile trigger).
