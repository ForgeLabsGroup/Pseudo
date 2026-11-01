-- PSEUDO initial schema. Every user-owned table has user_id + RLS (user_id = auth.uid()).
-- The API uses the service-role key ONLY for storage uploads and background jobs; normal
-- request handling uses a per-request client carrying the user's JWT so RLS applies.


-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- users (profiles) ----------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- personas ----------
create table public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  handle text,
  tagline text,
  description text not null,
  status text not null default 'draft'
    check (status in ('generating','draft','active','archived','failed')),
  identity jsonb,                      -- PersonaIdentity (validated by Zod before insert)
  current_version int not null default 0,
  avatar_asset_id uuid,               -- FK added after media_assets exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index personas_user_idx on public.personas(user_id, created_at desc);

create table public.persona_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete cascade,
  version int not null,
  identity jsonb not null,
  change_note text,
  created_at timestamptz not null default now(),
  unique (persona_id, version)
);

-- ---------- social accounts ----------
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('instagram','tiktok','youtube_shorts','x')),
  handle text not null,
  display_name text,
  mode text not null default 'mock' check (mode in ('mock','live')),
  status text not null default 'connected' check (status in ('connected','expired','revoked')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, handle)
);

-- OAuth tokens live in their own table with RLS on and NO policies: only the service role
-- (API server) can read it. Values are AES-256-GCM ciphertext (TOKEN_ENCRYPTION_KEY).
create table public.social_account_tokens (
  social_account_id uuid primary key references public.social_accounts(id) on delete cascade,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  scopes text[],
  updated_at timestamptz not null default now()
);
alter table public.social_account_tokens enable row level security;
revoke all on public.social_account_tokens from anon, authenticated;

-- ---------- campaigns ----------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete cascade,
  name text not null,
  brief text,
  strategy jsonb,                      -- Strategy Agent output
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- agent runs / events ----------
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete set null,
  agent text not null check (agent in ('persona','strategy','content','visual','video','distribution','analytics')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  provider text,
  model text,
  tokens_in int,
  tokens_out int,
  idempotency_key text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index agent_runs_user_idx on public.agent_runs(user_id, created_at desc);

create table public.agent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  step text not null,
  message text not null,
  data jsonb,
  created_at timestamptz not null default now()
);
create index agent_events_run_idx on public.agent_events(run_id, created_at);

-- ---------- content ----------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  persona_version int,                 -- which identity version generated this
  platform text not null check (platform in ('instagram','tiktok','youtube_shorts','x')),
  content_type text not null check (content_type in ('instagram_post','x_post','x_thread','short_video')),
  status text not null default 'draft' check (status in
    ('draft','generating','awaiting_approval','approved','rejected','scheduled','publishing','published','failed')),
  title text not null default '',
  body jsonb,                          -- ContentBody (validated by Zod before insert)
  approved_at timestamptz,
  scheduled_at timestamptz,
  published_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_user_status_idx on public.content_items(user_id, status, created_at desc);
create index content_persona_idx on public.content_items(persona_id, created_at desc);

-- ---------- media ----------
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete set null,
  kind text not null check (kind in ('image','video','audio')),
  source text not null check (source in ('reference_upload','ai_generated','rendered')),
  category text not null default 'other',
  storage_path text not null,
  url text not null,
  mime_type text not null,
  width int,
  height int,
  duration_sec numeric,
  prompt text,
  provider text,
  is_favorite boolean not null default false,
  ai_generated boolean generated always as (source <> 'reference_upload') stored,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index media_user_idx on public.media_assets(user_id, created_at desc);
create index media_persona_idx on public.media_assets(persona_id, kind);

alter table public.personas
  add constraint personas_avatar_fk foreign key (avatar_asset_id) references public.media_assets(id) on delete set null;

create table public.content_media (
  content_id uuid not null references public.content_items(id) on delete cascade,
  asset_id uuid not null references public.media_assets(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'primary',  -- primary | scene | voiceover | video
  position int not null default 0,
  primary key (content_id, asset_id)
);

-- ---------- publishing ----------
create table public.publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  social_account_id uuid references public.social_accounts(id) on delete set null,
  platform text not null,
  mode text not null default 'mock' check (mode in ('mock','live')),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index publishing_jobs_due_idx on public.publishing_jobs(status, run_at);
-- At most one active job per content item (idempotency).
create unique index publishing_jobs_one_active on public.publishing_jobs(content_id)
  where status in ('queued','running');

create table public.publishing_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  job_id uuid not null references public.publishing_jobs(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  platform text not null,
  mode text not null,
  success boolean not null,
  external_id text,
  external_url text,
  error text,
  response jsonb,
  created_at timestamptz not null default now()
);

-- Approval guard at the DB level: a job can only be created for approved/scheduled content.
create or replace function public.ensure_content_approved() returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.content_items c
    where c.id = new.content_id and c.approved_at is not null
      and c.status in ('approved','scheduled','publishing','failed')
  ) then
    raise exception 'content % is not approved', new.content_id;
  end if;
  return new;
end $$;
create trigger publishing_jobs_require_approval before insert on public.publishing_jobs
  for each row execute function public.ensure_content_approved();

-- ---------- analytics ----------
create table public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete cascade,
  content_id uuid references public.content_items(id) on delete cascade,
  platform text not null,
  is_sample boolean not null default true,  -- true = simulated demo data, must be labeled in UI
  captured_on date not null default current_date,
  impressions int not null default 0,
  likes int not null default 0,
  comments int not null default 0,
  shares int not null default 0,
  followers int,
  created_at timestamptz not null default now()
);
create index analytics_user_idx on public.analytics_snapshots(user_id, captured_on);

-- ---------- updated_at triggers ----------
create trigger t_users_updated before update on public.users for each row execute function public.set_updated_at();
create trigger t_personas_updated before update on public.personas for each row execute function public.set_updated_at();
create trigger t_social_updated before update on public.social_accounts for each row execute function public.set_updated_at();
create trigger t_campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();
create trigger t_content_updated before update on public.content_items for each row execute function public.set_updated_at();
create trigger t_jobs_updated before update on public.publishing_jobs for each row execute function public.set_updated_at();

-- ---------- RLS ----------
alter table public.users enable row level security;
create policy users_self on public.users for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'personas','persona_versions','social_accounts','campaigns','agent_runs','agent_events',
    'content_items','media_assets','content_media','publishing_jobs','publishing_records','analytics_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner', t);
  end loop;
end $$;

-- ---------- storage ----------
-- Public-read bucket so <img src> works without signed URLs. Paths are {user_id}/{persona_id}/{uuid}.ext
-- (unguessable). Writes go through the API with the service role.
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do nothing;
