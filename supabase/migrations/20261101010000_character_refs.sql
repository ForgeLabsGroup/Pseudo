-- Trained identity references per provider, e.g. {"higgsfield": {"id": "...", "status": "ready"}}.
-- Lets image/video generation lock the user's likeness (Higgsfield Soul ID, a LoRA, etc.).
alter table public.personas add column character_refs jsonb not null default '{}'::jsonb;
