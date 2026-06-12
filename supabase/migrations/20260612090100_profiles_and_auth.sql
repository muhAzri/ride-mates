-- ============================================================================
-- RideMates — 02 · Profiles, roles, settings, and location (privacy-first)
-- Source: FSD §5.1 (UA-1..6), §5.2.1/§5.2.2 (LP-1..5), API_CONTRACT.md §4, §5, §14, §17.1
-- ----------------------------------------------------------------------------
-- Supabase Auth owns `auth.users` (email/password + Google OAuth). It has no
-- application role, so we mirror every auth user into `public.profiles` and add
-- a `role` enum there. Admin = profiles.role = 'admin' (consumed by §15 admin
-- endpoints). Self-escalation is blocked by a guard trigger.
--
-- Privacy by table layout (enforces FSD LP-1 "precise coordinates are
-- server-only"): a row's columns cannot be hidden per-viewer by RLS, so we
-- SPLIT the user record into three tables by sensitivity:
--   * profiles       — public-readable (display name, area name, role, rating)
--   * user_settings  — owner-only (contact preference, notification toggles)
--   * user_locations — owner-only precise lat/lng; never selectable by others
-- Distance to other users/listings is only ever produced by SECURITY DEFINER
-- functions (see migration 03), never by exposing coordinates.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles — public projection of a user. Email lives in auth.users (read via
-- the session, not duplicated here). No coordinates here (privacy).
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text not null check (char_length(display_name) between 1 and 60),
  bio                text check (char_length(bio) <= 400),
  cycling_type       public.cycling_type,
  avatar_url         text,                                   -- null => client shows default placeholder (UA-4)
  display_area       text,                                   -- e.g. "Kebayoran Baru" (LP-2, MP-12)
  area_level         text default 'kecamatan',               -- granularity (FSD §13 → kecamatan)
  rating_average     numeric(2,1) check (rating_average between 0 and 5),  -- read-only display; see API §16 O1
  role               public.user_role not null default 'user',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- user_settings — owner-only. Backs Settings screen (16) private rows + NT prefs.
-- ----------------------------------------------------------------------------
create table public.user_settings (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  contact_preference  public.contact_preference not null default 'in_app_chat',  -- UA-3
  notif_new_messages  boolean not null default true,                             -- NT-1 toggle (16)
  notif_thread_replies boolean not null default true,                            -- NT-2 toggle (16)
  updated_at          timestamptz not null default now()
);

create trigger trg_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- user_locations — owner-only precise pin (MP-9). The single source of truth for
-- a user's location. Never exposed to other clients (LP-1). RLS denies all
-- access except the owner; distance is computed by SECURITY DEFINER functions.
-- ----------------------------------------------------------------------------
create table public.user_locations (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  updated_at  timestamptz not null default now()
);

create trigger trg_user_locations_updated_at
  before update on public.user_locations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- is_admin() — central authorization helper used by RLS everywhere.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- handle_new_user() — provision a profile + settings row on signup. Pulls a
-- display name from OAuth/signup metadata (Google sets full_name/name).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- enforce_profile_guard() — clients may edit their own display fields but must
-- NOT change server-managed columns (role, rating_average). Only admins change
-- role. This is the anti-privilege-escalation control for the admin page.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_profile_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_admin(auth.uid()) then
    raise exception 'Only admins can change a user role';
  end if;
  if new.rating_average is distinct from old.rating_average and not public.is_admin(auth.uid()) then
    -- rating is computed/server-managed; ignore client attempts to set it
    new.rating_average := old.rating_average;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_guard();

-- ----------------------------------------------------------------------------
-- set_my_location() — atomic location set (MP-9). The app performs reverse
-- geocoding once (FSD §5.2.1) and passes the resolved area in; this stores the
-- precise pin (owner-only) and the public area label together.
-- ----------------------------------------------------------------------------
create or replace function public.set_my_location(
  p_lat        double precision,
  p_lng        double precision,
  p_display_area text default null,
  p_area_level   text default 'kecamatan'
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.user_locations (user_id, lat, lng)
  values (v_uid, p_lat, p_lng)
  on conflict (user_id) do update
    set lat = excluded.lat, lng = excluded.lng, updated_at = now();

  update public.profiles
     set display_area = coalesce(p_display_area, display_area),
         area_level   = coalesce(p_area_level, area_level)
   where id = v_uid
   returning * into v_profile;

  return v_profile;  -- coordinates intentionally NOT returned (LP-1)
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles       enable row level security;
alter table public.user_settings  enable row level security;
alter table public.user_locations enable row level security;

-- profiles: any authenticated user may read any profile (public projection);
-- you may only update your own row (guard trigger still gates role/rating).
create policy profiles_select_all
  on public.profiles for select to authenticated
  using (true);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- user_settings: strictly owner-only.
create policy user_settings_rw_own
  on public.user_settings for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- user_locations: strictly owner-only. Other users can NEVER read this (LP-1).
create policy user_locations_rw_own
  on public.user_locations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant execute on function public.set_my_location(double precision, double precision, text, text) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
