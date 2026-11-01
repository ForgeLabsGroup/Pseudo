-- Research: archetypes, their reference influencers, cached per-video analyses and playbooks.
-- These are GLOBAL (shared by all users, curated by the team): authenticated users can read,
-- only the service role (API) writes.

create table public.archetypes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,               -- 'trader', 'ecommerce', 'fitness_coach'
  name text not null,
  description text not null,
  guardrails text[] not null default '{}', -- extra safety rules for this archetype
  created_at timestamptz not null default now()
);

create table public.archetype_influencers (
  id uuid primary key default gen_random_uuid(),
  archetype_id uuid not null references public.archetypes(id) on delete cascade,
  label text not null,                     -- internal label only; never shown in generated content
  handles jsonb not null default '{}'::jsonb, -- { "tiktok": "x", "instagram": "y", "youtube": "z", "x": "w" }
  created_at timestamptz not null default now(),
  unique (archetype_id, label)
);

-- Cache: each source video is watched once.
create table public.research_video_analyses (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.archetype_influencers(id) on delete cascade,
  platform text not null,
  source_url text not null,
  analysis jsonb not null,                 -- VideoAnalysis
  watcher text not null,                   -- e.g. 'gemini:gemini-2.5-flash'
  created_at timestamptz not null default now(),
  unique (influencer_id, source_url)
);

create table public.archetype_playbooks (
  id uuid primary key default gen_random_uuid(),
  archetype_id uuid not null references public.archetypes(id) on delete cascade,
  playbook jsonb not null,                 -- ArchetypePlaybook
  source_count int not null default 0,
  created_at timestamptz not null default now()
);
create index archetype_playbooks_latest_idx on public.archetype_playbooks(archetype_id, created_at desc);

alter table public.archetypes enable row level security;
alter table public.archetype_influencers enable row level security;
alter table public.research_video_analyses enable row level security;
alter table public.archetype_playbooks enable row level security;
create policy archetypes_read on public.archetypes for select to authenticated using (true);
create policy archetype_playbooks_read on public.archetype_playbooks for select to authenticated using (true);
-- influencers + raw analyses: service role only (no policies).

alter table public.personas add column archetype_id uuid references public.archetypes(id) on delete set null;

alter table public.agent_runs drop constraint agent_runs_agent_check;
alter table public.agent_runs add constraint agent_runs_agent_check
  check (agent in ('persona','strategy','content','visual','video','distribution','analytics','research'));
