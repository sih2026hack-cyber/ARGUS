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

-- Context Memory (lib/post-context.mjs): one row per post, summarised once and reused for every
-- later comment. content_version is a hash of the post's text; a changed post is summarised again.
create table if not exists public.post_contexts (
  key text primary key,              -- platform:post_id
  platform text not null,
  post_id text not null,
  content_version text not null,
  topic text not null,
  summary text not null,
  sensitivity text not null check (sensitivity in ('low', 'medium', 'high')),
  summary_status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.post_contexts enable row level security;
revoke all on public.post_contexts from anon, authenticated;
grant all on public.post_contexts to service_role;
