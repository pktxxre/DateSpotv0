-- DateSpot Supabase Schema
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/qlqcuuxhzdozjfboxeud/sql

-- ─────────────────────────────────────────────
-- 1. visits
-- ─────────────────────────────────────────────
create table if not exists public.visits (
  id            text primary key,
  user_id       uuid references auth.users(id) on delete cascade,
  venue_name    text not null,
  lat           float8 not null,
  lng           float8 not null,
  visited_at    timestamptz not null,
  rating        float8 not null default 0,
  rank_order    float8 not null default 0,
  notes         text,
  activity_type text not null default 'other',
  price         int2 not null default 2,
  photos        text,                          -- JSON array of Supabase Storage URLs
  triage        text not null default 'okay',  -- 'bad' | 'okay' | 'great'
  date_type     text,
  is_seed       boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.visits enable row level security;

-- Anyone (including anon) can read seed spots
create policy "read seed spots"
  on public.visits for select
  using (is_seed = true);

-- Authenticated users can read their own visits
create policy "read own visits"
  on public.visits for select
  to authenticated
  using (auth.uid() = user_id);

-- Authenticated users can insert their own visits
create policy "insert own visits"
  on public.visits for insert
  to authenticated
  with check (auth.uid() = user_id and is_seed = false);

-- Authenticated users can update their own visits
create policy "update own visits"
  on public.visits for update
  to authenticated
  using (auth.uid() = user_id and is_seed = false);

-- Authenticated users can delete their own visits
create policy "delete own visits"
  on public.visits for delete
  to authenticated
  using (auth.uid() = user_id and is_seed = false);

-- ─────────────────────────────────────────────
-- 2. future_spots
-- ─────────────────────────────────────────────
create table if not exists public.future_spots (
  id         text primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  venue_name text not null,
  lat        float8 not null,
  lng        float8 not null,
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.future_spots enable row level security;

create policy "read own future spots"
  on public.future_spots for select
  to authenticated
  using (auth.uid() = user_id);

create policy "insert own future spots"
  on public.future_spots for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own future spots"
  on public.future_spots for update
  to authenticated
  using (auth.uid() = user_id);

create policy "delete own future spots"
  on public.future_spots for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3. settings  (seed version tracking)
-- ─────────────────────────────────────────────
create table if not exists public.settings (
  key   text primary key,
  value text
);

alter table public.settings enable row level security;

-- Public read (used by app to check seed_version)
create policy "read settings"
  on public.settings for select
  using (true);

-- ─────────────────────────────────────────────
-- 4. Storage bucket: photos
-- ─────────────────────────────────────────────
-- Run separately in Storage dashboard if bucket doesn't exist yet.
-- insert into storage.buckets (id, name, public) values ('photos', 'photos', true);

-- Allow authenticated users to upload to photos bucket
-- create policy "upload photos"
--   on storage.objects for insert
--   to authenticated
--   with check (bucket_id = 'photos');

-- Allow public read of photos
-- create policy "read photos"
--   on storage.objects for select
--   using (bucket_id = 'photos');

-- ─────────────────────────────────────────────
-- 5. delete_user() — lets a user delete their own account
-- ─────────────────────────────────────────────
-- Run this in the Supabase SQL Editor. The SECURITY DEFINER clause lets it
-- run as the postgres superuser so it can delete from auth.users.
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
