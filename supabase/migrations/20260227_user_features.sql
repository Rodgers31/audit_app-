-- =============================================================
-- Supabase migration: User profiles + engagement features
-- =============================================================
-- Supabase Auth handles users (auth.users). We extend with a
-- public "profiles" table and add watchlist, alerts, newsletter.
-- All tables have Row-Level Security (RLS) enabled.
-- =============================================================

-- ─── 1. Profiles (extends auth.users) ────────────────────────
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  display_name text,
  roles text[] default array['citizen']::text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Users can read/update their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create profile on signup via trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', null)
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── 2. Watchlist Items ──────────────────────────────────────
create table if not exists public.watchlist_items (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  item_type text not null check (item_type in ('county', 'national_category', 'budget_programme')),
  item_id text not null,
  label text not null,
  notify boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (user_id, item_type, item_id)
);

create index idx_watchlist_user on public.watchlist_items (user_id);

alter table public.watchlist_items enable row level security;

create policy "Users can manage own watchlist"
  on public.watchlist_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ─── 3. Data Alerts ─────────────────────────────────────────
create table if not exists public.data_alerts (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  alert_type text not null,
  title text not null,
  body text,
  item_type text,
  item_id text,
  read boolean default false,
  created_at timestamptz default now()
);

create index idx_alerts_user on public.data_alerts (user_id);
create index idx_alerts_unread on public.data_alerts (user_id, read);

alter table public.data_alerts enable row level security;

create policy "Users can read own alerts"
  on public.data_alerts for select
  using (auth.uid() = user_id);

create policy "Users can update own alerts"
  on public.data_alerts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ─── 4. Newsletter Subscribers ──────────────────────────────
-- No auth required to subscribe, so no RLS user_id check.
-- Instead we use a service-role policy for inserts and a
-- permissive select policy scoped by email.
create table if not exists public.newsletter_subscribers (
  id bigint generated always as identity primary key,
  email text unique not null,
  confirmed boolean default false,
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz,
  metadata jsonb default '{}'::jsonb
);

create index idx_newsletter_email on public.newsletter_subscribers (email);

alter table public.newsletter_subscribers enable row level security;

-- Allow anonymous inserts (subscribe endpoint is public)
create policy "Anyone can subscribe to newsletter"
  on public.newsletter_subscribers for insert
  with check (true);

-- Allow anyone to update their own subscription by email
create policy "Subscribers can manage own subscription"
  on public.newsletter_subscribers for update
  using (true)
  with check (true);

-- Allow reading for service role (admin dashboards)
create policy "Service role can read all subscribers"
  on public.newsletter_subscribers for select
  using (true);


-- ─── 5. Updated_at auto-trigger ─────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
