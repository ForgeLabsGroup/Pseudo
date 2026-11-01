-- Research video storage: keep the downloaded source videos so analyses can be re-run with a
-- different watcher model without re-downloading (Instagram/TikTok CDN links expire).
-- Private bucket, NO storage.objects policies -> only the service role (API) can read/write;
-- the web app sees videos through short-lived signed URLs minted by the API.
-- Paths: {archetype_slug}/{influencer_label}/{platform}-{hash}.mp4

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'research-videos',
  'research-videos',
  false,
  52428800, -- 50 MiB (Supabase Free plan global cap)
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

alter table public.research_video_analyses
  add column storage_path text,    -- object path in the research-videos bucket
  add column content_hash text,    -- sha256 of the stored bytes
  add column size_bytes bigint,
  add column mime_type text,
  add column duration_s numeric,
  add column transcript text,      -- speech-to-text of the audio (service-role only table)
  add column frames_used int;      -- frames sent to the vision model
