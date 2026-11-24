-- Optional. Run once in the Supabase SQL editor when the server runs on a host with no persistent
-- disk (e.g. Render free plan), so credit spend and moderator decisions survive restarts.
-- Only the server's service-role key can read or write these tables.
create table if not exists public.argus_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.moderation_logs (
  id uuid primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);
alter table public.argus_state enable row level security;
alter table public.moderation_logs enable row level security;
revoke all on public.argus_state, public.moderation_logs from anon, authenticated;
grant all on public.argus_state, public.moderation_logs to service_role;
