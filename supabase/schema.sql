-- Lumen schema. Paste only this file into the Supabase SQL editor.
-- The first line must be this comment. A line that starts with the word info is a build log, not SQL.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  handle text not null default '',
  audience text not null default '',
  tone text not null default '',
  avoid text not null default '',
  channels jsonb not null default '{}'::jsonb
);

create table if not exists public.posts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  platform text not null,
  status text not null,
  scheduled_at timestamptz,
  published_at timestamptz,
  tags jsonb not null default jsonb_build_array(),
  pillar text not null default 'Craft',
  cta text not null default '',
  metrics jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  brand text not null,
  type text not null,
  amount numeric not null default 0,
  status text not null,
  due_at timestamptz,
  notes text not null default ''
);

create table if not exists public.experiments (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  hypothesis text not null default '',
  status text not null,
  result text not null default ''
);

create index if not exists posts_user_idx on public.posts (user_id);
create index if not exists deals_user_idx on public.deals (user_id);
create index if not exists experiments_user_idx on public.experiments (user_id);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.deals enable row level security;
alter table public.experiments enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own posts" on public.posts;
create policy "own posts" on public.posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own deals" on public.deals;
create policy "own deals" on public.deals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own experiments" on public.experiments;
create policy "own experiments" on public.experiments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
