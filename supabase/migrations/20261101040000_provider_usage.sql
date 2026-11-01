-- One row per paid provider request PSEUDO makes (Higgsfield likeness training, images, clips),
-- so users can see what was spent on their behalf. Higgsfield exposes no balance/usage API, so
-- this ledger is the only in-app record; the provider dashboard stays the billing source of truth.
create table public.provider_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete set null,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  provider text not null,
  operation text not null check (operation in ('character','image','video')),
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  error text,
  video_seconds numeric,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index provider_usage_user_idx on public.provider_usage(user_id, provider, started_at desc);

-- Users read their own ledger; only the API (service role) writes it.
alter table public.provider_usage enable row level security;
create policy provider_usage_read on public.provider_usage for select using (user_id = auth.uid());
